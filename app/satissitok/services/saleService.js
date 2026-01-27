// app/satissitok/services/saleService.js

import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  readStockBalancesForSale,
  writeSaleStockMovements,
  writeStockBalancesAfterSale,
  writeStockBalancesAfterReturn,
} from "@/app/satissitok/services/stockService";

// ⚠️ createCariTransaction burada (admin/cari) dosyasında duruyor demiştin
import {
  createCariTransaction,
} from "@/app/satissitok/admin/cari/services/cariService";

const round2 = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

async function getNextSaleNumber(tx) {
  const counterRef = doc(db, "sale_counters", "main");
  const snap = await tx.get(counterRef);

  let next = 1;
  if (snap.exists()) {
    next = (snap.data().last || 0) + 1;
    tx.update(counterRef, { last: next });
  } else {
    tx.set(counterRef, { last: next });
  }

  return String(next).padStart(6, "0");
}

export async function createSale({
  saleType, // "actual" | "official"
  cariId,
  items, // [{ productId, productName, quantity, unitPrice, vatRate }]
  note = "",
}) {
  if (!saleType || !cariId || !Array.isArray(items) || items.length === 0) {
    throw new Error("Eksik satış bilgisi");
  }

  return await runTransaction(db, async (transaction) => {
    const saleNo = await getNextSaleNumber(transaction);
    const saleRef = doc(collection(db, "sales"));

    // 1) Stok balanslarını oku (avgCost + qty) → satış maliyetini buradan kilitle
    const saleBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType,
    });

    // 2) Kalemleri normalize + hesapla
    let netTotal = 0;
    let vatTotal = 0;
    let grossTotal = 0;
    let totalCost = 0;

    const normalizedItems = items.map((row) => {
      const productId = row.productId;
      const productName = row.productName || "";
      const quantity = Number(row.quantity || 0);
      const unitPrice = Number(row.unitPrice || 0);
      const vatRate = saleType === "official" ? Number(row.vatRate || 0) : 0;

      if (!productId) throw new Error("productId boş olamaz");
      if (quantity <= 0) throw new Error("Miktar sıfır olamaz");

      const bal = saleBalances[productId] || { qty: 0, avgCost: 0 };
      if (bal.qty < quantity) throw new Error("Yetersiz stok");

      const costAtSale = round2(Number(bal.avgCost || 0));

      const lineNet = round2(quantity * unitPrice);
      const lineVat = round2(lineNet * (vatRate / 100));
      const lineTotal = round2(lineNet + lineVat);

      const lineCost = round2(quantity * costAtSale);

      netTotal += lineNet;
      vatTotal += lineVat;
      grossTotal += lineTotal;
      totalCost += lineCost;

      return {
        productId,
        productName,
        quantity,
        unitPrice,
        vatRate,
        net: lineNet,
        vat: lineVat,
        total: lineTotal,
        costAtSale, // 🔥 kilit maliyet
      };
    });

    netTotal = round2(netTotal);
    vatTotal = round2(vatTotal);
    grossTotal = round2(grossTotal);
    totalCost = round2(totalCost);

    const grossProfit = round2(grossTotal - totalCost);
    const grossMargin = grossTotal > 0 ? round2((grossProfit / grossTotal) * 100) : 0;

    // 3) SALES (CACHE alanları dahil)
    transaction.set(saleRef, {
      saleNo,
      saleType,
      cariId,

      netTotal,
      vatTotal,
      grossTotal,

      // ✅ PERF CACHE
      totalCost,
      grossProfit,
      grossMargin, // %

      note,
      status: "completed",
      createdAt: serverTimestamp(),
    });

    // 4) ITEMS yaz
    normalizedItems.forEach((it) => {
      const itemRef = doc(collection(saleRef, "items"));
      transaction.set(itemRef, it);
    });

    // 5) STOCK movement + balance düş
    writeSaleStockMovements({
      transaction,
      saleId: saleRef.id,
      saleType,
      items: normalizedItems,
    });

    writeStockBalancesAfterSale({
      transaction,
      saleType,
      items: normalizedItems,
      saleBalances,
    });

    // 6) CARI zorunlu (satış → debit)
    await createCariTransaction(transaction, {
      cariId,
      type: "debit",
      source: "sale",
      refId: saleRef.id,
      amount: grossTotal,
    });

    return { saleId: saleRef.id, saleNo };
  });
}

export async function cancelSale({ saleId, reason = "" }) {
  if (!saleId) throw new Error("saleId gerekli");

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);

    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status !== "completed") throw new Error("Bu satış iptal edilemez");

    // items oku
    const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
    const items = itemsSnap.docs.map((d) => d.data());

    // stok geri eklemek için önce mevcut balansları oku
    const saleBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType: sale.saleType,
    });

    // stok geri (qty +)
    writeStockBalancesAfterReturn({
      transaction,
      saleType: sale.saleType,
      items,
      saleBalances,
    });

    // movement (opsiyonel; istersen stock_movements’a cancel kaydı da yazabiliriz)
    // burada minimum müdahale: balans düzelt + cari ters kayıt

    // cari ters kayıt (credit)
    await createCariTransaction(transaction, {
      cariId: sale.cariId,
      type: "credit",
      source: "sale_cancel",
      refId: saleId,
      amount: Number(sale.grossTotal || 0),
    });

    transaction.update(saleRef, {
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: serverTimestamp(),
    });

    return { ok: true };
  });
}

export async function returnSale({ saleId, reason = "" }) {
  if (!saleId) throw new Error("saleId gerekli");

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);

    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status !== "completed") throw new Error("Bu satış iade edilemez");

    // items oku
    const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
    const items = itemsSnap.docs.map((d) => d.data());

    // stok geri eklemek için balansları oku
    const saleBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType: sale.saleType,
    });

    // stok geri (qty +)
    writeStockBalancesAfterReturn({
      transaction,
      saleType: sale.saleType,
      items,
      saleBalances,
    });

    // cari ters kayıt (credit)
    await createCariTransaction(transaction, {
      cariId: sale.cariId,
      type: "credit",
      source: "sale_return",
      refId: saleId,
      amount: Number(sale.grossTotal || 0),
    });

    transaction.update(saleRef, {
      status: "returned",
      returnReason: reason,
      returnedAt: serverTimestamp(),
    });

    return { ok: true };
  });
}
