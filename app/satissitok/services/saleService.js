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

import { createCariTransaction } from "@/app/satissitok/admin/cari/services/cariService";

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
  // ✅ purchase ile aynı stil: SR-26-000001 / SF-26-000001
  return `${prefix}-${yy}-${pad6(seq)}`;
}

/* ===============================
   CREATE SALE (CONFIRMED)
   - writes sales/{id}
   - writes sales/{id}/items
   - writes stock_movements (out)
   - updates stock_balances (qty decreases, can go negative)
   - increments sale_counters/main for every sale (purchase ile aynı)
================================ */

export async function createSale(payload) {
  return await runTransaction(db, async (transaction) => {
    const saleType = payload?.saleType === "actual" ? "actual" : "official";
    const saleChannel = (payload?.saleChannel || payload?.platformId || "other").trim();
    const cariId = payload?.cariId || null;

    const payment = payload?.payment || {};
    const paymentMethod = (payment.method || payload?.paymentMethod || "").trim();
    const paidAmount = Number(payment.paidAmount ?? payload?.paidAmount ?? 0) || 0;

    const invoiceDateISO = payload?.invoiceDate || new Date().toISOString().slice(0, 10);
    const yy = year2FromDateISO(invoiceDateISO);

    // UI: kullanıcı inputa dokunmadıysa true gönderir
    const invoiceNoAutoFlag = payload?.invoiceNoAuto === true;
    const manualInvoice = (payload?.invoiceNo || payload?.docNo || "").trim();

    /* =====================
       READ PHASE
    ===================== */

    // 1) Sayaç oku (purchase mantığı: her satışta sayaç tükenecek)
    const counterRef = doc(db, "sale_counters", "main");
    const counterSnap = await transaction.get(counterRef);

    if (!counterSnap.exists()) {
      throw new Error("Sayaç bulunamadı: sale_counters/main");
    }

    const counters = counterSnap.data();
    const key = saleType === "official" ? "official" : "actual";

    const currentSeq = Number(counters[key] || 0);
    const nextSeq = currentSeq + 1;

    // ✅ Auto invoice = her zaman counter’dan üretilir
    const autoInvoice = formatSaleInvoiceNo(saleType, yy, nextSeq);

    // ✅ Kaydedilecek invoiceNo seçimi:
    // - invoiceNoAuto=true  => autoInvoice
    // - invoiceNoAuto=false => manualInvoice (boşsa autoInvoice)
    const invoiceNo = invoiceNoAutoFlag ? autoInvoice : (manualInvoice || autoInvoice);

    // audit
    const invoiceNoAuto = invoiceNoAutoFlag ? autoInvoice : null;
    const invoiceNoManual = !invoiceNoAutoFlag && Boolean(manualInvoice);

    // 2) Stok bakiyeleri + avgCost oku
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const existingBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType,
    });

    // 3) Negatif stok kontrolü (bloklama yok)
    const soldByKey = {};
    for (const it of items) {
      if (!it?.productId) continue;
      const whKey = (it.warehouseKey || "main").trim() || "main";
      const q = Number(it.quantity || 0);
      if (!q) continue;
      const k = `${it.productId}__${whKey}`;
      soldByKey[k] = (soldByKey[k] || 0) + q;
    }

    const negativeStockItems = [];
    for (const [compoundKey, sold] of Object.entries(soldByKey)) {
      const [productId, warehouseKey] = compoundKey.split("__");
      const available = Number(existingBalances?.[compoundKey]?.qty || 0);
      if (available < sold) {
        negativeStockItems.push({ productId, warehouseKey, available, sold });
      }
    }

    /* =====================
       WRITE PHASE
    ===================== */

    // ✅ Sayaç HER SATIŞTA güncellenecek (purchase ile aynı)
    transaction.set(counterRef, { [key]: nextSeq }, { merge: true });

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

      const whKey = (row.warehouseKey || "main").trim() || "main";
      const balKey = `${row.productId}__${whKey}`;
      const avgCost = Number(existingBalances?.[balKey]?.avgCost || 0);
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

        warehouseKey: whKey,

        quantity,
        unitPrice,
        discountRate,

        vatRate: saleType === "official" ? Number(row.vatRate || 0) : 0,

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

    // vat summary (tek oran ise yaz, değilse null)
    const ratesUsed = Array.from(
      new Set(
        (items || [])
          .filter((x) => x?.productId)
          .map((x) => Number(x.vatRate || 0))
      )
    );
    const saleVatRate =
      saleType === "official" && ratesUsed.length === 1 ? ratesUsed[0] : null;

    transaction.set(saleRef, {
      // legacy alanlar
      saleNo: invoiceNo,
      saleType,

      // yeni alanlar
      saleChannel,
      platformId: saleChannel,
      invoiceNo,
      invoiceNoAuto,
      invoiceNoManual,

      cariId: cariId || null,

      vatRate: saleType === "official" ? saleVatRate : 0,
      vatRatesUsed: saleType === "official" ? ratesUsed : [],
      vatMode: saleType === "official" ? (payload?.vatMode || "exclude") : null,
      payment: {
        method: paymentMethod || null,
        paidAmount: paidAmount > 0 ? Math.round(paidAmount * 100) / 100 : 0,
      },

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
        productId: r.productId,
        productName: r.productName || "",
        warehouseKey: (r.warehouseKey || "main").trim() || "main",
        quantity: Number(r.quantity || 0),
        unit: r.unit || "",
        unitPrice: Number(r.unitPrice || 0),
        total: Number(r.total || 0),
      }));

    writeSaleStockMovements({
      transaction,
      saleId: saleRef.id,
      saleType,
      items: itemsForStock,
      invoiceNo,
      documentDate: invoiceDateISO || null,
      currency: "KZT",
      saleChannel,
    });

    writeStockBalancesAfterSale({
      transaction,
      saleType,
      items: itemsForStock,
      existingBalances,
    });

    // cari hareketi
    if (cariId) {
      await createCariTransaction({
        transaction,
        cariId,
        operationType: "sale_invoice",
        operationDate: invoiceDateISO ? new Date(invoiceDateISO) : null,
        dueDate: payload?.dueDate ? new Date(payload.dueDate) : null,
        documentNo: invoiceNo,
        debit: Number(grossTotal || 0),
        credit: 0,
        currency: "KZT",
        description: payload?.description || "Satış faturası",
        operationCategory: payload?.operationCategory || "sales",
      });
    }

    return {
      saleId: saleRef.id,
      invoiceNo,
    };
  });
}

export async function cancelSale({ saleId }) {
  if (!saleId) throw new Error("saleId zorunlu");

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status === "cancelled") return true;

    const saleType = sale.saleType === "actual" ? "actual" : "official";

    // items oku
    const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
    const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const existingBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType,
    });

    // reverse stock
    writeSaleStockMovements({
      transaction,
      saleId,
      saleType,
      items,
      invoiceNo: sale.invoiceNo || sale.saleNo || "",
      documentDate: sale.documentDate || sale.invoiceDate || null,
      currency: "KZT",
      reverse: true,
      saleChannel: sale.saleChannel || sale.platformId || "other",
    });

    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items,
      existingBalances,
    });

    // cari reverse
    if (sale.cariId) {
      await createCariTransaction({
        transaction,
        cariId: sale.cariId,
        operationType: "sale_cancel",
        operationDate: new Date(),
        documentNo: sale.invoiceNo || sale.saleNo || "",
        debit: 0,
        credit: Number(sale.grossTotal || 0),
        currency: "KZT",
        description: "Satış faturası iptali",
        operationCategory: "sales",
      });
    }

    transaction.update(saleRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return true;
  });
}