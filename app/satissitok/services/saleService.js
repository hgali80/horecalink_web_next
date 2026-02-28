// app/satissitok/services/saleService.js
import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

import {
  readStockBalancesForSale,
  writeSaleStockMovements,
  writeStockBalancesAfterSale,
  writeStockBalancesAfterReturn,
} from "./stockService";

import { reserveNextInvoiceNo } from "./invoiceCounterService";

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
  return `${prefix}-${yy}-${pad6(seq)}`;
}

/* ===============================
   CREATE SALE (CONFIRMED)
   - writes sales/{id}
   - writes sales/{id}/items
   - writes stock_movements (out)
   - updates stock_balances (qty decreases, can go negative)
   - increments invoice_counters/sales for EVERY sale (auto or manual)
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

    const manualInvoice = (payload?.invoiceNo || payload?.docNo || "").trim();

    // ✅ UI: kullanıcı inputa dokunmadıysa true gönderiyor
    // - invoiceNoAuto=true  => sistem üretir (SR-YY-000001 / SF-YY-000001)
    // - invoiceNoAuto=false => manuel kaydeder (boşsa sistem üretir)
    const invoiceNoAutoFlag = payload?.invoiceNoAuto === true;

    /* =====================
       READ PHASE
    ===================== */

    // ✅ Sayaç her satış için tükecek (auto / manual fark etmez) – YEAR-AWARE, MODÜLER
    const { nextSeq } = await reserveNextInvoiceNo({
      transaction,
      kind: "sales",
      type: saleType,
      dateISO: invoiceDateISO,
    });

    const autoInvoice = formatSaleInvoiceNo(saleType, yy, nextSeq);

    // ✅ Kaydedilecek invoiceNo seçimi
    const invoiceNo = invoiceNoAutoFlag ? autoInvoice : manualInvoice || autoInvoice;

    // UI / audit amaçlı alanlar (mevcut alan isimleri korunuyor)
    const invoiceNoAuto = invoiceNo === autoInvoice ? autoInvoice : null;
    const invoiceNoManual = invoiceNo !== autoInvoice;
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

    // Sayaç güncelle (her satışta)
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
      invoiceNoAuto: invoiceNoAuto || null,
      invoiceNoManual,
      invoiceSequence: nextSeq, // audit (yıl içi sıra)
      invoiceYear2: yy, // audit (YY)
      invoiceCounterRef: "invoice_counters/sales", // audit

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
        ...r,
        warehouseKey: (r.warehouseKey || "main").trim() || "main",
        costAtSale: Number(
          existingBalances?.[`${r.productId}__${((r.warehouseKey || "main").trim() || "main")}`]?.avgCost || 0
        ),
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

    /* =====================
       CARİ HAREKETLERİ (SEÇENEK 6B)
       - satış: müşteri borç (debit)
       - tahsilat: alacak (credit)
    ===================== */
    if (cariId) {
      createCariTransaction(transaction, {
        cariId,
        type: "debit",
        source: "sale",
        refId: saleRef.id,
        amount: grossTotal,
        operationDate: invoiceDateISO,
        currency: "KZT",
        note: `Satış faturası: ${invoiceNo}`,
      });

      if (paidAmount > 0) {
        createCariTransaction(transaction, {
          cariId,
          type: "credit",
          source: "sale_payment",
          refId: saleRef.id,
          amount: paidAmount,
          operationDate: invoiceDateISO,
          currency: "KZT",
          paymentMethod: paymentMethod || null,
          note: `Tahsilat (${paymentMethod || ""}) - ${invoiceNo}`,
        });
      }
    }

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