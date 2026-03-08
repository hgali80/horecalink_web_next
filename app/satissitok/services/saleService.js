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

import { reserveNextInvoiceNo } from "./invoiceCounterService";
import { createCariTransaction } from "@/app/satissitok/admin/cari/services/cariService";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function toDateOrNull(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildSaleDraftTotals(items = []) {
  let netTotal = 0;
  let vatTotal = 0;
  let grossTotal = 0;

  for (const row of items) {
    if (!row?.productId) continue;
    netTotal += Number(row.net || 0);
    vatTotal += Number(row.vat || 0);
    grossTotal += Number(row.total || 0);
  }

  return {
    netTotal: round2(netTotal),
    vatTotal: round2(vatTotal),
    grossTotal: round2(grossTotal),
  };
}

/* ===============================
   CREATE / SAVE SALE
   - status=draft    => sadece belge taslağı kaydedilir
   - status=completed => stok / cari / sayaç yazılır
================================ */

export async function createSale(payload) {
  return await runTransaction(db, async (transaction) => {
    const saleType = payload?.saleType === "actual" ? "actual" : "official";
    const saleChannel = (payload?.saleChannel || payload?.platformId || "other").trim();
    const cariId = payload?.cariId || null;
    const status = payload?.status === "draft" ? "draft" : "completed";
    const draftId = (payload?.draftId || "").trim() || null;

    const payment = payload?.payment || {};
    const paymentMethod = (payment.method || payload?.paymentMethod || "").trim();
    const paidAmount = Number(payment.paidAmount ?? payload?.paidAmount ?? 0) || 0;

    const invoiceDateISO = payload?.invoiceDate || new Date().toISOString().slice(0, 10);
    const manualInvoice = (payload?.invoiceNo || payload?.docNo || "").trim();
    const invoiceNoAutoFlag = payload?.invoiceNoAuto === true;
    const items = Array.isArray(payload?.items) ? payload.items : [];

    const saleRef = draftId ? doc(db, "sales", draftId) : doc(collection(db, "sales"));
    const existingSnap = draftId ? await transaction.get(saleRef) : null;
    const existingData = existingSnap?.exists() ? existingSnap.data() : null;
    const createdAtValue = existingData?.createdAt || serverTimestamp();

    if (status === "draft") {
      const totals = buildSaleDraftTotals(items);

      transaction.set(
        saleRef,
        {
          saleNo: manualInvoice || null,
          saleType,
          saleChannel,
          platformId: saleChannel,
          invoiceNo: manualInvoice || null,
          invoiceNoAuto: null,
          invoiceNoManual: Boolean(manualInvoice),
          invoiceSequence: null,
          invoiceYear2: null,
          invoiceCounterRef: null,
          cariId,
          vatMode: payload?.vatMode || "exclude",
          payment: {
            method: paymentMethod || null,
            paidAmount: round2(paidAmount),
            isPaid: Boolean(payment.isPaid),
          },
          netTotal: totals.netTotal,
          vatTotal: saleType === "official" ? totals.vatTotal : 0,
          grossTotal: totals.grossTotal,
          costTotalUsed: 0,
          profitTotal: 0,
          hasNegativeStock: false,
          negativeStockItems: [],
          status: "draft",
          processStatus: payload?.processStatus || "draft",
          invoiceDate: toDateOrNull(invoiceDateISO),
          documentDate: toDateOrNull(invoiceDateISO),
          dueDate: toDateOrNull(payload?.dueDate),
          meta: payload?.meta || {},
          items,
          draftSavedAt: serverTimestamp(),
          createdAt: createdAtValue,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return { saleId: saleRef.id, status: "draft" };
    }

    /* =====================
       READ PHASE (ALL READS FIRST)
    ===================== */

    const existingBalances = await readStockBalancesForSale({
      transaction,
      items,
      saleType,
    });

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

    const { yy, nextSeq, autoInvoice } = await reserveNextInvoiceNo({
      transaction,
      kind: "sales",
      type: saleType,
      dateISO: invoiceDateISO,
    });

    const invoiceNo = invoiceNoAutoFlag ? autoInvoice : manualInvoice || autoInvoice;
    const invoiceNoAuto = invoiceNo === autoInvoice ? autoInvoice : null;
    const invoiceNoManual = invoiceNo !== autoInvoice;

    let netTotal = 0;
    let vatTotal = 0;
    let grossTotal = 0;
    let costTotalUsed = 0;
    let profitTotal = 0;

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

    netTotal = round2(netTotal);
    vatTotal = round2(vatTotal);
    grossTotal = round2(grossTotal);
    costTotalUsed = round2(costTotalUsed);
    profitTotal = round2(profitTotal);

    const ratesUsed = Array.from(
      new Set(
        (items || [])
          .filter((x) => x?.productId)
          .map((x) => Number(x.vatRate || 0))
      )
    );
    const saleVatRate = saleType === "official" && ratesUsed.length === 1 ? ratesUsed[0] : null;

    transaction.set(
      saleRef,
      {
        saleNo: invoiceNo,
        saleType,
        saleChannel,
        platformId: saleChannel,
        invoiceNo,
        invoiceNoAuto: invoiceNoAuto || null,
        invoiceNoManual,
        invoiceSequence: nextSeq,
        invoiceYear2: yy,
        invoiceCounterRef: "invoice_counters/sales",
        cariId: cariId || null,
        vatRate: saleType === "official" ? saleVatRate : 0,
        vatRatesUsed: saleType === "official" ? ratesUsed : [],
        vatMode: saleType === "official" ? (payload?.vatMode || "exclude") : null,
        payment: {
          method: paymentMethod || null,
          paidAmount: paidAmount > 0 ? round2(paidAmount) : 0,
          isPaid: Boolean(payment.isPaid),
        },
        netTotal,
        vatTotal: saleType === "official" ? vatTotal : 0,
        grossTotal,
        costTotalUsed,
        profitTotal,
        hasNegativeStock: negativeStockItems.length > 0,
        negativeStockItems,
        status: "completed",
        processStatus: payload?.processStatus || "approved",
        invoiceDate: toDateOrNull(invoiceDateISO),
        documentDate: toDateOrNull(invoiceDateISO),
        dueDate: toDateOrNull(payload?.dueDate),
        meta: payload?.meta || {},
        items,
        draftSavedAt: null,
        createdAt: createdAtValue,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const itemsForStock = items
      .filter((r) => r?.productId && Number(r.quantity || 0) > 0)
      .map((r) => ({
        ...r,
        warehouseKey: (r.warehouseKey || "main").trim() || "main",
        costAtSale: Number(
          existingBalances?.[
            `${r.productId}__${((r.warehouseKey || "main").trim() || "main")}`
          ]?.avgCost || 0
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

    writeStockBalancesAfterSale({
      transaction,
      saleType,
      items: itemsForStock,
      existingBalances,
    });

    if (cariId) {
      createCariTransaction(transaction, {
        cariId,
        type: "debit",
        source: "sale",
        refId: saleRef.id,
        amount: grossTotal,
        documentNo: invoiceNo,
        description: "Satış faturası",
        operationDate: toDateOrNull(invoiceDateISO),
      });

      if (paidAmount > 0) {
        createCariTransaction(transaction, {
          cariId,
          type: "credit",
          source: "sale_payment",
          refId: saleRef.id,
          amount: Math.min(round2(paidAmount), grossTotal),
          documentNo: invoiceNo,
          description: "Satış tahsilatı",
          operationDate: toDateOrNull(invoiceDateISO),
        });
      }
    }

    return { saleId: saleRef.id, status: "completed" };
  });
}

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

    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
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