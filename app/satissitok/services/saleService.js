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
} from "./stockService";

/* ===============================
   INVOICE NO HELPERS
================================ */

function pad6(n) {
  return String(Number(n) || 0).padStart(6, "0");
}

function year2FromDateISO(dateISO) {
  if (!dateISO) return String(new Date().getFullYear()).slice(-2);
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime())
    ? String(new Date().getFullYear()).slice(-2)
    : String(d.getFullYear()).slice(-2);
}

function formatSaleInvoiceNo(saleType, yy, seq) {
  const prefix = saleType === "official" ? "SR" : "SF";
  return `${prefix}-${yy}${pad6(seq)}`;
}

/* ===============================
   CREATE SALE (CONFIRMED)
   - writes sales/{id}
   - writes sales/{id}/items
   - writes stock_movements (out)
   - updates stock_balances (qty decreases, can go negative)
   - increments sale_counters/main only when invoiceNo was auto-generated
================================ */

export async function createSale(payload) {
  return await runTransaction(db, async (transaction) => {
    const saleType = payload?.saleType === "actual" ? "actual" : "official";
    const saleChannel = (payload?.saleChannel || payload?.platformId || "other").trim();
    const cariId = payload?.cariId || null;

    const invoiceDateISO = payload?.invoiceDate || new Date().toISOString().slice(0, 10);
    const yy = year2FromDateISO(invoiceDateISO);

    const incomingInvoiceNo = (payload?.invoiceNo || payload?.docNo || "").trim();
    const incomingInvoiceNoAuto = (payload?.invoiceNoAuto || "").trim();
    const invoiceNoDirty = Boolean(payload?.invoiceNoManual || payload?.invoiceNoDirty);

    /* =====================
       READ PHASE
    ===================== */

    // 1) Sayaç oku (sadece invoiceNo yoksa üretmek için)
    let invoiceNo = incomingInvoiceNo;
    let invoiceNoAuto = incomingInvoiceNoAuto || "";
    let invoiceNoManual = false;
    let nextSeq = null;

    if (!invoiceNo) {
      const counterRef = doc(db, "sale_counters", "main");
      const counterSnap = await transaction.get(counterRef);

      const counters = counterSnap.exists()
        ? counterSnap.data()
        : { official: 0, actual: 0 };

      nextSeq = Number(counters[saleType] || 0) + 1;
      invoiceNo = formatSaleInvoiceNo(saleType, yy, nextSeq);
      invoiceNoAuto = invoiceNo;
      invoiceNoManual = false;
    } else {
      invoiceNoAuto = invoiceNoAuto || (invoiceNoDirty ? "" : invoiceNo);
      invoiceNoManual = invoiceNoDirty || (invoiceNoAuto && invoiceNo !== invoiceNoAuto);
    }

    // 2) Stok bakiyeleri + avgCost oku
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const existingBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType,
    });

    // 3) Negatif stok kontrolü (bloklama yok)
    const soldByProduct = {};
    for (const it of items) {
      if (!it?.productId) continue;
      const q = Number(it.quantity || 0);
      if (!q) continue;
      soldByProduct[it.productId] = (soldByProduct[it.productId] || 0) + q;
    }

    const negativeStockItems = [];
    for (const [productId, sold] of Object.entries(soldByProduct)) {
      const available = Number(existingBalances?.[productId]?.qty || 0);
      if (available < sold) {
        negativeStockItems.push({ productId, available, sold });
      }
    }

    /* =====================
       WRITE PHASE
    ===================== */

    // Sayaç güncelle (sadece sistem ürettiyse)
    if (nextSeq !== null) {
      const counterRef = doc(db, "sale_counters", "main");
      transaction.set(counterRef, { [saleType]: nextSeq }, { merge: true });
    }

    // Satış doc
    const saleRef = doc(collection(db, "sales"));

    // Totals + Profit (snapshot cost used from avgCost)
    let netTotal = 0;
    let vatTotal = 0;
    let grossTotal = 0;

    let costTotalUsed = 0;
    let profitTotal = 0;

    // items subcollection
    const itemsCol = collection(db, "sales", saleRef.id, "items");

    for (const row of items) {
      if (!row?.productId) continue;

      const quantity = Number(row.quantity || 0);
      if (quantity <= 0) continue;

      const unitPrice = Number(row.unitPrice || 0);
      const discountRate = Number(row.discountRate || 0);

      const net = Number(row.net || 0);
      const vat = Number(row.vat || 0);
      const total = Number(row.total || 0);

      netTotal += net;
      vatTotal += vat;
      grossTotal += total;

      const avgCost = Number(existingBalances?.[row.productId]?.avgCost || 0);
      const costAtSale = avgCost;

      const lineCost = Math.round(quantity * costAtSale * 100) / 100;
      const lineProfit = Math.round((net - lineCost) * 100) / 100;

      costTotalUsed += lineCost;
      profitTotal += lineProfit;

      const itemRef = doc(itemsCol);

      transaction.set(itemRef, {
        productId: row.productId,
        productName: row.productName || "",
        unit: row.unit || "",

        quantity,
        unitPrice,
        discountRate,

        net,
        vat: saleType === "official" ? vat : 0,
        total,

        costAtSale,
        lineCost,
        profit: lineProfit,
      });
    }

    netTotal = Math.round(netTotal * 100) / 100;
    vatTotal = Math.round(vatTotal * 100) / 100;
    grossTotal = Math.round(grossTotal * 100) / 100;
    costTotalUsed = Math.round(costTotalUsed * 100) / 100;
    profitTotal = Math.round(profitTotal * 100) / 100;

    transaction.set(saleRef, {
      // legacy alanlar
      saleNo: invoiceNo,
      saleType,

      // yeni alanlar
      saleChannel,
      platformId: saleChannel,
      invoiceNo,
      invoiceNoAuto: invoiceNoAuto || null,
      invoiceNoManual,

      cariId: cariId || null,

      vatRate: saleType === "official" ? Number(payload?.vatRate || 0) : 0,
      vatMode: saleType === "official" ? (payload?.vatMode || "exclude") : null,

      netTotal,
      vatTotal: saleType === "official" ? vatTotal : 0,
      grossTotal,

      costTotalUsed,
      profitTotal,

      hasNegativeStock: negativeStockItems.length > 0,
      negativeStockItems,

      status: "completed",

      invoiceDate: invoiceDateISO ? new Date(invoiceDateISO) : null,
      documentDate: invoiceDateISO ? new Date(invoiceDateISO) : null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // stok hareketleri (out)
    const itemsForStock = items
      .filter((r) => r?.productId && Number(r.quantity || 0) > 0)
      .map((r) => ({
        ...r,
        costAtSale: Number(existingBalances?.[r.productId]?.avgCost || 0),
      }));

    writeSaleStockMovements({
      transaction,
      saleId: saleRef.id,
      saleType,
      items: itemsForStock,
      saleChannel,
      invoiceNo,
      invoiceDate: invoiceDateISO,
    });

    // stok bakiyesi düş (negatif olabilir)
    writeStockBalancesAfterSale({
      transaction,
      saleType,
      items: itemsForStock,
      existingBalances,
    });

    return { saleId: saleRef.id };
  });
}

/* ===============================
   CANCEL SALE (reverse stock, mark cancelled)
================================ */
export async function cancelSale({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");

  const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status !== "completed") return;

    const saleType = sale.saleType === "actual" ? "actual" : "official";

    const existingBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType,
    });

    // stok geri ekle
    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      existingBalances,
    });

    // iptal hareketi yaz
    const stockCollection = collection(db, "stock_movements");
    for (const it of items) {
      if (!it.productId || !it.quantity) continue;
      const qty = Number(it.quantity) || 0;
      if (!qty) continue;

      const ref = doc(stockCollection);
      transaction.set(ref, {
        productId: it.productId,
        productName: it.productName || "",
        unit: it.unit || "",

        qty: qty,

        type: "sale_cancel",
        saleId,
        saleType,
        bucket: saleType === "official" ? "official" : "actual",

        unitCost: Number(it.costAtSale || 0),
        totalCost: Math.round(qty * Number(it.costAtSale || 0) * 100) / 100,

        saleChannel: sale.saleChannel || sale.platformId || null,
        invoiceNo: sale.saleNo || sale.invoiceNo || "",
        documentDate: sale.documentDate?.toDate ? sale.documentDate.toDate() : null,

        createdAt: serverTimestamp(),
      });
    }

    transaction.set(
      saleRef,
      {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

/* ===============================
   RETURN SALE (reverse stock, mark returned)
================================ */
export async function returnSale({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");

  const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status !== "completed") return;

    const saleType = sale.saleType === "actual" ? "actual" : "official";

    const existingBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType,
    });

    // stok geri ekle
    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      existingBalances,
    });

    // iade hareketi yaz
    const stockCollection = collection(db, "stock_movements");
    for (const it of items) {
      if (!it.productId || !it.quantity) continue;
      const qty = Number(it.quantity) || 0;
      if (!qty) continue;

      const ref = doc(stockCollection);
      transaction.set(ref, {
        productId: it.productId,
        productName: it.productName || "",
        unit: it.unit || "",

        qty: qty,

        type: "sale_return",
        saleId,
        saleType,
        bucket: saleType === "official" ? "official" : "actual",

        unitCost: Number(it.costAtSale || 0),
        totalCost: Math.round(qty * Number(it.costAtSale || 0) * 100) / 100,

        saleChannel: sale.saleChannel || sale.platformId || null,
        invoiceNo: sale.saleNo || sale.invoiceNo || "",
        documentDate: sale.documentDate?.toDate ? sale.documentDate.toDate() : null,

        createdAt: serverTimestamp(),
      });
    }

    transaction.set(
      saleRef,
      {
        status: "returned",
        returnedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}
