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

import {
  reserveNextInvoiceNo,
  reserveNextDraftNo,
} from "./invoiceCounterService";
import { createCariTransaction } from "@/app/satissitok/admin/cari/services/cariService";

/* ===============================
   CREATE / UPDATE SALE
   - draft / pending => no stock, no avgCost, no cari, no item subcollection
   - completed       => final flow
================================ */

function normalizeStatus(status) {
  const s = String(status || "completed").trim().toLowerCase();
  if (
    s === "draft" ||
    s === "pending" ||
    s === "completed" ||
    s === "cancelled" ||
    s === "returned"
  ) {
    return s;
  }
  return "completed";
}

function round2(n) {
  const x = Number(n) || 0;
  return Math.round(x * 100) / 100;
}

function toDateOrNull(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeItems(items) {
  return Array.isArray(items) ? items : [];
}

function computeDraftTotals(items, saleType) {
  let netTotal = 0;
  let vatTotal = 0;
  let grossTotal = 0;

  for (const row of items) {
    if (!row?.productId) continue;

    const net = Number(row.net || 0);
    const vat = Number(row.vat || 0);
    const total = Number(row.total || 0);

    netTotal += net;
    vatTotal += vat;
    grossTotal += total;
  }

  netTotal = round2(netTotal);
  vatTotal = round2(vatTotal);
  grossTotal = round2(grossTotal);

  return {
    netTotal,
    vatTotal: saleType === "official" ? vatTotal : 0,
    grossTotal,
  };
}

export async function createSale(payload) {
  return await runTransaction(db, async (transaction) => {
    const saleType = payload?.saleType === "actual" ? "actual" : "official";
    const status = normalizeStatus(payload?.status || "completed");
    const isFinal = status === "completed";

    const saleChannel = (payload?.saleChannel || payload?.platformId || "other").trim();
    const cariId = payload?.cariId || null;

    const payment = payload?.payment || {};
    const paymentMethod = (payment.method || payload?.paymentMethod || "").trim();
    const paidAmount = Number(payment.paidAmount ?? payload?.paidAmount ?? 0) || 0;

    const invoiceDateISO =
      payload?.invoiceDate || new Date().toISOString().slice(0, 10);

    const manualInvoice = (payload?.invoiceNo || payload?.docNo || "").trim();
    const invoiceNoAutoFlag = payload?.invoiceNoAuto === true;

    const items = normalizeItems(payload?.items);
    const saleId = (payload?.saleId || payload?.id || "").trim();
    const isUpdate = !!saleId;

    /* =====================
       READ PHASE (ALL READS FIRST)
    ===================== */

    const saleRef = isUpdate ? doc(db, "sales", saleId) : doc(collection(db, "sales"));
    const existingSnap = isUpdate ? await transaction.get(saleRef) : null;
    const existingData = existingSnap?.exists() ? existingSnap.data() : null;

    if (isUpdate && !existingData) {
      throw new Error("Güncellenecek satış kaydı bulunamadı");
    }

    const prevStatus = normalizeStatus(existingData?.status || "draft");
    const prevWasFinal = prevStatus === "completed";

    let existingBalances = null;
    let negativeStockItems = [];
    let itemsForStock = [];

    // Sadece yeni finalleşme anında stok okunur
    const needsStockRead = isFinal && !prevWasFinal;

    if (needsStockRead) {
      // 1) Stok bakiyeleri + avgCost oku
      existingBalances = await readStockBalancesForSale({
        transaction,
        items,
        saleType,
      });

      // 2) Negatif stok kontrolü
      const soldByKey = {};
      for (const it of items) {
        if (!it?.productId) continue;
        const whKey = (it.warehouseKey || "main").trim() || "main";
        const q = Number(it.quantity || 0);
        if (!q) continue;
        const k = `${it.productId}__${whKey}`;
        soldByKey[k] = (soldByKey[k] || 0) + q;
      }

      for (const [compoundKey, sold] of Object.entries(soldByKey)) {
        const [productId, warehouseKey] = compoundKey.split("__");
        const available = Number(existingBalances?.[compoundKey]?.qty || 0);
        if (available < sold) {
          negativeStockItems.push({ productId, warehouseKey, available, sold });
        }
      }

      itemsForStock = items
        .filter((r) => r?.productId && Number(r.quantity || 0) > 0)
        .map((r) => {
          const whKey = (r.warehouseKey || "main").trim() || "main";
          const bal = existingBalances?.[`${r.productId}__${whKey}`] || {};

          const avgCost = Number(bal.avgCost || 0);
          const manualPurchaseUnitCost = Number(
            r.purchaseUnitCost ?? r.costAtSale ?? 0
          );
          const costAtSale =
            manualPurchaseUnitCost > 0 ? manualPurchaseUnitCost : avgCost;

          return {
            ...r,
            warehouseKey: whKey,
            purchaseUnitCost: manualPurchaseUnitCost > 0 ? manualPurchaseUnitCost : 0,
            costAtSale,
            costSource:
              manualPurchaseUnitCost > 0
                ? "manual"
                : bal.costSource || (saleType === "official" ? "official" : "actual"),
            fallbackOfficialAvgCost: Number(bal.fallbackOfficialAvgCost || 0),
          };
        });
    }

    let invoiceNo = "";
    let invoiceNoAuto = null;
    let invoiceNoManual = false;
    let invoiceSequence = existingData?.invoiceSequence ?? null;
    let invoiceYear2 = existingData?.invoiceYear2 ?? null;
    let invoiceCounterRef = existingData?.invoiceCounterRef ?? null;

    let draftNo = existingData?.draftNo ?? null;
    let draftSequence = existingData?.draftSequence ?? null;
    let draftYear2 = existingData?.draftYear2 ?? null;
    let draftCounterRef = existingData?.draftCounterRef ?? null;

    if (isFinal) {
      if (prevWasFinal && existingData?.invoiceNo) {
        // zaten final kayıt ise numara korunur
        invoiceNo = String(existingData.invoiceNo || "").trim();
        invoiceNoAuto = existingData.invoiceNoAuto ?? null;
        invoiceNoManual = !!existingData.invoiceNoManual;
      } else {
        // yeni final kayıt ya da draft -> final dönüşümü
        const { yy, nextSeq, autoInvoice } = await reserveNextInvoiceNo({
          transaction,
          kind: "sales",
          type: saleType,
          dateISO: invoiceDateISO,
        });

        invoiceNo = invoiceNoAutoFlag ? autoInvoice : manualInvoice || autoInvoice;
        invoiceNoAuto = invoiceNo === autoInvoice ? autoInvoice : null;
        invoiceNoManual = invoiceNo !== autoInvoice;

        invoiceSequence = nextSeq;
        invoiceYear2 = yy;
        invoiceCounterRef = "invoice_counters/sales";
      }
    } else {
      if (existingData?.draftNo) {
        invoiceNo = existingData.draftNo;
        draftNo = existingData.draftNo;
        draftSequence = existingData?.draftSequence ?? null;
        draftYear2 = existingData?.draftYear2 ?? null;
        draftCounterRef = existingData?.draftCounterRef ?? "draft_counters/sales";
      } else {
        const { yy, nextSeq, autoDraftNo } = await reserveNextDraftNo({
          transaction,
          kind: "sales",
          dateISO: invoiceDateISO,
        });

        invoiceNo = autoDraftNo;
        draftNo = autoDraftNo;
        draftSequence = nextSeq;
        draftYear2 = yy;
        draftCounterRef = "draft_counters/sales";
      }

      invoiceNoAuto = null;
      invoiceNoManual = false;
      invoiceSequence = null;
      invoiceYear2 = null;
      invoiceCounterRef = null;
    }

    /* =====================
       TOTALS / PROFIT
    ===================== */

    let netTotal = 0;
    let vatTotal = 0;
    let grossTotal = 0;
    let costTotalUsed = 0;
    let profitTotal = 0;

    if (needsStockRead) {
      for (const row of items) {
        if (!row?.productId) continue;

        const quantity = Number(row.quantity || 0);
        if (quantity <= 0) continue;

        const net = Number(row.net || 0);
        const vat = Number(row.vat || 0);
        const total = Number(row.total || 0);

        netTotal += net;
        vatTotal += vat;
        grossTotal += total;

        const whKey = (row.warehouseKey || "main").trim() || "main";
        const balKey = `${row.productId}__${whKey}`;
        const bal = existingBalances?.[balKey] || {};

        const avgCost = Number(bal.avgCost || 0);
        const manualPurchaseUnitCost = Number(
          row.purchaseUnitCost ?? row.costAtSale ?? 0
        );
        const costAtSale =
          manualPurchaseUnitCost > 0 ? manualPurchaseUnitCost : avgCost;

        const lineCost = round2(quantity * costAtSale);
        const lineProfit = round2(net - lineCost);

        costTotalUsed += lineCost;
        profitTotal += lineProfit;
      }

      netTotal = round2(netTotal);
      vatTotal = round2(vatTotal);
      grossTotal = round2(grossTotal);
      costTotalUsed = round2(costTotalUsed);
      profitTotal = round2(profitTotal);
    } else {
      const totals = computeDraftTotals(items, saleType);
      netTotal = totals.netTotal;
      vatTotal = totals.vatTotal;
      grossTotal = totals.grossTotal;
      costTotalUsed = 0;
      profitTotal = 0;
      negativeStockItems = [];
    }

    // vat summary
    const ratesUsed = Array.from(
      new Set(
        (items || [])
          .filter((x) => x?.productId)
          .map((x) => Number(x.vatRate || 0))
      )
    );
    const saleVatRate =
      saleType === "official" && ratesUsed.length === 1 ? ratesUsed[0] : null;

    /* =====================
       WRITE PHASE
    ===================== */

    const saleData = {
      // legacy alanlar
      saleNo: invoiceNo,
      saleType,

      // yeni alanlar
      saleChannel,
      platformId: saleChannel,

      invoiceNo,
      invoiceNoAuto: invoiceNoAuto || null,
      invoiceNoManual,
      invoiceSequence,
      invoiceYear2,
      invoiceCounterRef,

      draftNo,
      draftSequence,
      draftYear2,
      draftCounterRef,

      cariId: cariId || null,

      vatRate: saleType === "official" ? saleVatRate : 0,
      vatRatesUsed: saleType === "official" ? ratesUsed : [],
      vatMode: saleType === "official" ? payload?.vatMode || "exclude" : null,

      payment: {
        method: paymentMethod || null,
        paidAmount: paidAmount > 0 ? round2(paidAmount) : 0,
      },

      items, // draft edit için ana dokümanda da saklıyoruz
      netTotal,
      vatTotal: saleType === "official" ? vatTotal : 0,
      grossTotal,

      costTotalUsed,
      profitTotal,

      hasNegativeStock: negativeStockItems.length > 0,
      negativeStockItems,

      status,
      isDraftLike: status !== "completed",

      invoiceDate: toDateOrNull(invoiceDateISO),
      documentDate: toDateOrNull(invoiceDateISO),

      approvedAt:
        status === "completed" && !prevWasFinal ? serverTimestamp() : existingData?.approvedAt ?? null,
      finalizedAt:
        status === "completed" && !prevWasFinal ? serverTimestamp() : existingData?.finalizedAt ?? null,

      updatedAt: serverTimestamp(),
    };

    if (isUpdate) {
      transaction.set(saleRef, saleData, { merge: true });
    } else {
      transaction.set(saleRef, {
        ...saleData,
        createdAt: serverTimestamp(),
      });
    }

    /* =====================
       ITEMS SUBCOLLECTION
       Sadece finalleşme anında yaz
    ===================== */

    if (needsStockRead) {
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

        const whKey = (row.warehouseKey || "main").trim() || "main";
        const balKey = `${row.productId}__${whKey}`;
        const bal = existingBalances?.[balKey] || {};

        const avgCost = Number(bal.avgCost || 0);
        const manualPurchaseUnitCost = Number(
          row.purchaseUnitCost ?? row.costAtSale ?? 0
        );
        const costAtSale =
          manualPurchaseUnitCost > 0 ? manualPurchaseUnitCost : avgCost;

        const costSource =
          manualPurchaseUnitCost > 0
            ? "manual"
            : bal.costSource || (saleType === "official" ? "official" : "actual");

        const fallbackOfficialAvgCost = Number(bal.fallbackOfficialAvgCost || 0);

        const lineCost = round2(quantity * costAtSale);
        const lineProfit = round2(net - lineCost);

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

          purchaseUnitCost: manualPurchaseUnitCost > 0 ? manualPurchaseUnitCost : 0,
          costAtSale,
          costSource,
          fallbackOfficialAvgCost,
          lineCost,
          profit: lineProfit,
        });
      }
    }

    /* =====================
       STOK HAREKETLERİ
       Sadece finalleşme anında
    ===================== */

    if (needsStockRead) {
      writeSaleStockMovements({
        transaction,
        saleId: saleRef.id,
        saleType,
        items: itemsForStock,
        saleChannel,
        invoiceNo,
        invoiceDate: invoiceDateISO,
      });

      writeStockBalancesAfterSale({
        transaction,
        saleType,
        items: itemsForStock,
        existingBalances,
      });
    }

    /* =====================
       CARİ HAREKETLERİ
       Sadece finalleşme anında
    ===================== */

    if (needsStockRead && cariId) {
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
   DELETE DRAFT SALE
   - Sadece draft / pending silinir
================================ */
export async function deleteDraftSale({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);

    if (!saleSnap.exists()) {
      throw new Error("Taslak satış bulunamadı");
    }

    const sale = saleSnap.data();
    const status = normalizeStatus(sale?.status || "draft");

    if (status === "completed") {
      throw new Error("Tamamlanmış satış taslak olarak silinemez");
    }

    transaction.delete(saleRef);
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

    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        warehouseKey: i.warehouseKey || "main",
      })),
      existingBalances,
    });

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

        qty,

        type: "sale_cancel",
        saleId,
        saleType,
        bucket: saleType === "official" ? "official" : "actual",

        warehouseKey: (it.warehouseKey || "main").trim() || "main",

        unitCost: Number(it.costAtSale || 0),
        totalCost: Math.round(qty * Number(it.costAtSale || 0) * 100) / 100,
        costSource: it.costSource || null,
        fallbackOfficialAvgCost: Number(it.fallbackOfficialAvgCost || 0),

        saleChannel: sale.saleChannel || sale.platformId || null,
        invoiceNo: sale.saleNo || sale.invoiceNo || "",
        documentDate: sale.documentDate?.toDate
          ? sale.documentDate.toDate()
          : sale.documentDate || null,

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

    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        warehouseKey: i.warehouseKey || "main",
      })),
      existingBalances,
    });

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

        qty,

        type: "sale_return",
        saleId,
        saleType,
        bucket: saleType === "official" ? "official" : "actual",

        warehouseKey: (it.warehouseKey || "main").trim() || "main",

        unitCost: Number(it.costAtSale || 0),
        totalCost: Math.round(qty * Number(it.costAtSale || 0) * 100) / 100,
        costSource: it.costSource || null,
        fallbackOfficialAvgCost: Number(it.fallbackOfficialAvgCost || 0),

        saleChannel: sale.saleChannel || sale.platformId || null,
        invoiceNo: sale.saleNo || sale.invoiceNo || "",
        documentDate: sale.documentDate?.toDate
          ? sale.documentDate.toDate()
          : sale.documentDate || null,

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