// app/satissitok/services/saleService.js
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  readStockBalancesForSale,
  writeSaleStockMovements,
  writeStockBalancesAfterSale,
  writeStockBalancesAfterReturn,
} from "./stockService";

function yearYY(d) {
  const dt = d instanceof Date ? d : new Date();
  return String(dt.getFullYear()).slice(-2);
}

async function generateInvoiceNo(transaction, saleType, invoiceDateStr) {
  const dt = invoiceDateStr ? new Date(invoiceDateStr) : new Date();
  const yy = yearYY(dt);

  // sayaç yıllık ayrı olsun
  const counterId = saleType === "official" ? `sale_official_${yy}` : `sale_actual_${yy}`;
  const ref = doc(db, "sale_counters", counterId);
  const snap = await transaction.get(ref);

  let next = 1;
  if (snap.exists()) next = Number(snap.data().lastNo || 0) + 1;

  transaction.set(ref, { lastNo: next, updatedAt: serverTimestamp() }, { merge: true });

  const prefix = saleType === "official" ? "SR" : "SF";
  // örnek: 26 + 000001 = 26000001
  const no8 = `${yy}${String(next).padStart(6, "0")}`;
  return `${prefix}-${no8}`;
}

function normalizeItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((x) => ({
      productId: x.productId || "",
      productName: x.productName || "",
      quantity: Number(x.quantity || 0),
      unit: x.unit || "",
      unitPrice: Number(x.unitPrice || 0),
      discountRate: Number(x.discountRate || 0),

      net: Number(x.net || 0),
      vat: Number(x.vat || 0),
      total: Number(x.total || 0),
    }))
    .filter((x) => x.productId && x.quantity > 0);
}

export async function createSale(payload) {
  return await runTransaction(db, async (transaction) => {
    const {
      saleType,
      invoiceDate,
      platformId,
      cariId,
      vatRate,
      vatMode,
      items,
    } = payload || {};

    if (!platformId) throw new Error("Satış platformu zorunlu");
    if (!cariId) throw new Error("Cari zorunlu");

    const cleanItems = normalizeItems(items);
    if (!cleanItems.length) throw new Error("Ürün satırı yok");

    const saleNo = await generateInvoiceNo(transaction, saleType, invoiceDate);

    // cost + stock balances (avgCost okuma)
    const balances = await readStockBalancesForSale({
      transaction,
      items: cleanItems,
      saleType,
    });

    const enrichedItems = cleanItems.map((it) => {
      const b = balances[it.productId] || {};
      const costAtSale = Number(b.avgCost || 0);
      const totalCost = Math.round(Number(it.quantity) * costAtSale * 100) / 100;
      return { ...it, costAtSale, totalCost };
    });

    // totals: sadece satır sonuçlarının toplamı
    let netTotal = 0,
      vatTotal = 0,
      grossTotal = 0,
      costTotal = 0;

    for (const i of enrichedItems) {
      netTotal += Number(i.net || 0);
      vatTotal += Number(i.vat || 0);
      grossTotal += Number(i.total || 0);
      costTotal += Number(i.totalCost || 0);
    }

    netTotal = Math.round(netTotal * 100) / 100;
    vatTotal = Math.round(vatTotal * 100) / 100;
    grossTotal = Math.round(grossTotal * 100) / 100;
    costTotal = Math.round(costTotal * 100) / 100;

    const saleRef = doc(collection(db, "sales"));

    transaction.set(saleRef, {
      saleNo,
      saleType, // official|actual
      platformId,
      cariId,

      vatRate: Number(vatRate || 0),
      vatMode: vatMode || "exclude",

      netTotal,
      vatTotal,
      grossTotal,
      costTotal,

      status: "completed",
      invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
      createdAt: serverTimestamp(),
    });

    // items subcollection
    const itemsCol = collection(db, "sales", saleRef.id, "items");
    enrichedItems.forEach((it) => {
      const ref = doc(itemsCol);
      transaction.set(ref, {
        ...it,
        createdAt: serverTimestamp(),
      });
    });

    // stock movements + balances update (negatif serbest)
    writeSaleStockMovements({
      transaction,
      saleId: saleRef.id,
      saleType,
      items: enrichedItems,
    });

    writeStockBalancesAfterSale({
      transaction,
      saleType,
      items: enrichedItems,
      saleBalances: balances,
    });

    return { saleId: saleRef.id, saleNo };
  });
}

async function readSaleAndItems(transaction, saleId) {
  const saleRef = doc(db, "sales", saleId);
  const saleSnap = await transaction.get(saleRef);
  if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

  const sale = { id: saleSnap.id, ...saleSnap.data() };

  // subcollection read (transaction içinde: getDocs kullanamazsın)
  // çözüm: item id’lerini sale doc içinde tutmak gerekir.
  // ŞU ANKİ PROJEDE itemler subcollection — transaction ile toplu okumak için
  // basit yaklaşım: iptal/iade için transaction dışı okuma + sonra transaction.
  // Ama bu atomicity bozar. Bu yüzden: iptal/iade işlemini "runTransaction" değil,
  // "batch write" ile yapmayacağız. Burada pratik ve güvenli çözüm:
  // -> önce itemleri normal okuruz, sonra transaction’a gireriz.

  return { sale };
}

export async function cancelSale({ saleId }) {
  // 1) itemleri normal oku
  const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // 2) transaction: status + stok geri ekle + movement
  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status !== "completed") throw new Error("Sadece completed satış iptal edilebilir");

    const saleType = sale.saleType;

    const cleanItems = normalizeItems(items);

    const balances = await readStockBalancesForSale({
      transaction,
      items: cleanItems,
      saleType,
    });

    // stok geri ekle
    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: cleanItems,
      saleBalances: balances,
    });

    // hareket yaz (iptal)
    const stockCollection = collection(db, "stock_movements");
    cleanItems.forEach((it) => {
      const ref = doc(stockCollection);
      transaction.set(ref, {
        productId: it.productId,
        productName: it.productName || "",
        unit: it.unit || "",
        qty: Number(it.quantity || 0), // geri ekleme (+)
        type: "sale_cancel",
        saleId,
        saleType,
        createdAt: serverTimestamp(),
      });
    });

    transaction.set(
      saleRef,
      { status: "cancelled", cancelledAt: serverTimestamp() },
      { merge: true }
    );

    return true;
  });
}

export async function returnSale({ saleId }) {
  // iade = iptal gibi stok geri ekler, status farklı
  const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status !== "completed") throw new Error("Sadece completed satış iade alınabilir");

    const saleType = sale.saleType;
    const cleanItems = normalizeItems(items);

    const balances = await readStockBalancesForSale({
      transaction,
      items: cleanItems,
      saleType,
    });

    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: cleanItems,
      saleBalances: balances,
    });

    const stockCollection = collection(db, "stock_movements");
    cleanItems.forEach((it) => {
      const ref = doc(stockCollection);
      transaction.set(ref, {
        productId: it.productId,
        productName: it.productName || "",
        unit: it.unit || "",
        qty: Number(it.quantity || 0),
        type: "sale_return",
        saleId,
        saleType,
        createdAt: serverTimestamp(),
      });
    });

    transaction.set(saleRef, { status: "returned", returnedAt: serverTimestamp() }, { merge: true });

    return true;
  });
}
