import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  buildSaleStockPlan,
  readStockBalancesForSale,
  writeSaleStockMovements,
  writeStockBalancesAfterReturn,
  writeStockBalancesAfterSale,
} from "./stockService";
import { reserveNextInvoiceNo } from "./invoiceCounterService";
import { getDefaultCashAccountId } from "./cashAccountService";
import { initializeSettlementFields } from "./documentSettlementService";
import { writeCashMovementTransaction } from "./financeService";
import { normalizeDocumentItemSnapshot } from "./inventoryCatalogService";
import {
  isConfirmedStatus,
  isDraftStatus,
  normalizeDocumentStatus,
} from "./documentFlow";
import { createCariTransaction } from "@/app/satissitok/admin/cari/services/cariService";

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
  return Array.isArray(items)
    ? items.map((row) => normalizeDocumentItemSnapshot(row))
    : [];
}

function readNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildDraftTotals(items, saleType) {
  let netTotal = 0;
  let vatTotal = 0;
  let grossTotal = 0;

  for (const row of items) {
    if (!row?.productId) continue;
    netTotal += readNumber(row.net);
    vatTotal += readNumber(row.vat);
    grossTotal += readNumber(row.total);
  }

  return {
    netTotal: round2(netTotal),
    vatTotal: saleType === "official" ? round2(vatTotal) : 0,
    grossTotal: round2(grossTotal),
  };
}

function mapFinalizedItems({ items, saleType, linePlans }) {
  const planMap = new Map(
    (linePlans || []).map((row) => {
      const key = [
        row.productId,
        row.warehouseKey || "main",
        readNumber(row.quantity),
        readNumber(row.unitPrice),
      ].join("__");
      return [key, row];
    })
  );

  return (items || [])
    .filter((row) => row?.productId && readNumber(row.quantity) > 0)
    .map((row) => {
      const key = [
        row.productId,
        row.warehouseKey || "main",
        readNumber(row.quantity),
        readNumber(row.unitPrice),
      ].join("__");
      const planned = planMap.get(key) || row;
      const quantity = round2(readNumber(planned.quantity ?? row.quantity));
      const net = round2(readNumber(row.net));
      const vat = saleType === "official" ? round2(readNumber(row.vat)) : 0;
      const total = round2(readNumber(row.total));
      const totalCost = round2(readNumber(planned.totalCost));

      return {
        ...row,
        warehouseKey: (planned.warehouseKey || row.warehouseKey || "main").trim() || "main",
        quantity,
        vatRate: saleType === "official" ? readNumber(row.vatRate) : 0,
        net,
        vat,
        total,
        stockConsumption: Array.isArray(planned.stockConsumption)
          ? planned.stockConsumption
          : [],
        costBreakdown: Array.isArray(planned.costBreakdown) ? planned.costBreakdown : [],
        totalCost,
        profit: round2(net - totalCost),
      };
    });
}

function createStatusPayload({
  payloadStatus,
  existingStatus,
  fallback = "draft",
}) {
  if (payloadStatus === undefined || payloadStatus === null || payloadStatus === "") {
    return normalizeDocumentStatus(existingStatus, { fallback });
  }
  return normalizeDocumentStatus(payloadStatus, { fallback });
}

function buildSaleMovementRows(items) {
  return (items || []).flatMap((item) => {
    const parts = Array.isArray(item.costBreakdown)
      ? item.costBreakdown
      : Array.isArray(item.stockConsumption)
      ? item.stockConsumption
      : [];

    return parts
      .map((part) => {
        const qty = round2(readNumber(part.qty));
        if (!item?.productId || !(qty > 0)) return null;

        const unitCost = round2(
          readNumber(part.unitCost ?? part.costAtSale ?? item.costAtSale)
        );

        return {
          ...item,
          warehouseKey: (item.warehouseKey || "main").trim() || "main",
          stockConsumption: [
            {
              bucket: part.bucket === "official" ? "official" : "actual",
              qty,
              unitCost,
            },
          ],
          costBreakdown: [
            {
              bucket: part.bucket === "official" ? "official" : "actual",
              qty,
              unitCost,
              totalCost: round2(qty * unitCost),
            },
          ],
        };
      })
      .filter(Boolean);
  });
}

export async function createSale(payload) {
  const payment = payload?.payment || {};
  const paidAmount = round2(payment.paidAmount ?? payload?.paidAmount ?? 0);
  const defaultAccountId = paidAmount > 0
    ? payload?.payment?.accountId || payload?.accountId || (await getDefaultCashAccountId())
    : null;

  if (paidAmount > 0 && !defaultAccountId) {
    throw new Error("Pesin tahsilat icin varsayilan kasa/banka hesabi gerekli");
  }

  return runTransaction(db, async (transaction) => {
    const saleType = payload?.saleType === "actual" ? "actual" : "official";
    const saleChannel = (payload?.saleChannel || payload?.platformId || "other").trim();
    const cariId = payload?.cariId || null;
    const paymentMethod = (payment.method || payload?.paymentMethod || "").trim();
    const invoiceDateISO =
      payload?.invoiceDate || payload?.documentDate || new Date().toISOString().slice(0, 10);
    const manualInvoice = (payload?.invoiceNo || payload?.docNo || "").trim();
    const invoiceNoAutoFlag = payload?.invoiceNoAuto === true;

    const items = normalizeItems(payload?.items);
    const saleId = (payload?.saleId || payload?.id || "").trim();
    const isUpdate = !!saleId;

    const saleRef = isUpdate ? doc(db, "sales", saleId) : doc(collection(db, "sales"));
    const existingSnap = isUpdate ? await transaction.get(saleRef) : null;
    const existingData = existingSnap?.exists() ? existingSnap.data() : null;

    if (isUpdate && !existingData) {
      throw new Error("Guncellenecek satis kaydi bulunamadi");
    }

    const status = createStatusPayload({
      payloadStatus: payload?.status,
      existingStatus: existingData?.status,
      fallback: "draft",
    });
    const isConfirmed = isConfirmedStatus(status);
    const prevStatus = normalizeDocumentStatus(existingData?.status, { fallback: "draft" });
    const prevWasConfirmed = isConfirmedStatus(prevStatus);
    const needsFinalize = isConfirmed && !prevWasConfirmed;

    let existingBalances = null;
    let finalizedItems = [];
    let stockErrors = [];

    if (needsFinalize) {
      existingBalances = await readStockBalancesForSale({
        transaction,
        items,
        saleType,
      });

      const plan = buildSaleStockPlan({
        saleType,
        items,
        existingBalances,
      });

      finalizedItems = mapFinalizedItems({
        items,
        saleType,
        linePlans: plan.linePlans,
      });
      stockErrors = plan.stockErrors || [];

      if (finalizedItems.length !== items.filter((row) => row?.productId && readNumber(row.quantity) > 0).length) {
        stockErrors.push({
          reason: "missing_finalized_lines",
        });
      }

      if (stockErrors.length > 0) {
        throw new Error("Stok yetersiz. Satis onaylanamadi.");
      }
    } else if (prevWasConfirmed && Array.isArray(existingData?.items)) {
      finalizedItems = existingData.items;
    }

    let invoiceNo = existingData?.invoiceNo || null;
    let invoiceNoAuto = existingData?.invoiceNoAuto ?? null;
    let invoiceNoManual = !!existingData?.invoiceNoManual;
    let invoiceSequence = existingData?.invoiceSequence ?? null;
    let invoiceYear2 = existingData?.invoiceYear2 ?? null;
    let invoiceCounterRef = existingData?.invoiceCounterRef ?? null;

    if (isConfirmed) {
      if (!prevWasConfirmed || !invoiceNo) {
        const { yy, nextSeq, autoInvoice, counterRefPath } = await reserveNextInvoiceNo({
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
        invoiceCounterRef = counterRefPath;
      }
    } else {
      invoiceNo = null;
      invoiceNoAuto = null;
      invoiceNoManual = false;
      invoiceSequence = null;
      invoiceYear2 = null;
      invoiceCounterRef = null;
    }

    const activeItems = needsFinalize ? finalizedItems : items;
    const draftTotals = buildDraftTotals(activeItems, saleType);

    const netTotal = round2(
      activeItems.reduce((sum, row) => sum + readNumber(row.net), 0)
    );
    const vatTotal =
      saleType === "official"
        ? round2(activeItems.reduce((sum, row) => sum + readNumber(row.vat), 0))
        : 0;
    const grossTotal = round2(
      activeItems.reduce((sum, row) => sum + readNumber(row.total), 0)
    );
    const costTotalUsed = needsFinalize
      ? round2(activeItems.reduce((sum, row) => sum + readNumber(row.totalCost), 0))
      : 0;
    const profitTotal = needsFinalize
      ? round2(activeItems.reduce((sum, row) => sum + readNumber(row.profit), 0))
      : 0;

    const totals = isConfirmed
      ? { netTotal, vatTotal, grossTotal, costTotalUsed, profitTotal }
      : {
          netTotal: draftTotals.netTotal,
          vatTotal: draftTotals.vatTotal,
          grossTotal: draftTotals.grossTotal,
          costTotalUsed: 0,
          profitTotal: 0,
        };

    const ratesUsed = Array.from(
      new Set(
        activeItems
          .filter((row) => row?.productId)
          .map((row) => Number(row.vatRate || 0))
      )
    );
    const saleVatRate =
      saleType === "official" && ratesUsed.length === 1 ? ratesUsed[0] : null;

    const saleData = {
      saleNo: invoiceNo || null,
      saleType,
      saleChannel,
      platformId: saleChannel,
      invoiceNo,
      documentNo: invoiceNo,
      invoiceNoAuto,
      invoiceNoManual,
      invoiceSequence,
      invoiceYear2,
      invoiceCounterRef,
      draftNo: null,
      draftSequence: null,
      draftYear2: null,
      draftCounterRef: null,
      cariId,
      vatRate: saleType === "official" ? saleVatRate : 0,
      vatRatesUsed: saleType === "official" ? ratesUsed : [],
      vatMode: saleType === "official" ? payload?.vatMode || "exclude" : null,
      payment: {
        method: paymentMethod || null,
        paidAmount: paidAmount > 0 ? paidAmount : 0,
      },
      items: activeItems,
      netTotal: totals.netTotal,
      vatTotal: totals.vatTotal,
      grossTotal: totals.grossTotal,
      costTotalUsed: totals.costTotalUsed,
      profitTotal: totals.profitTotal,
      ...initializeSettlementFields({ invoiceAmount: totals.grossTotal }),
      hasNegativeStock: false,
      negativeStockItems: [],
      status,
      isDraftLike: !isConfirmed,
      invoiceDate: toDateOrNull(invoiceDateISO),
      documentDate: toDateOrNull(invoiceDateISO),
      approvedAt:
        needsFinalize ? serverTimestamp() : existingData?.approvedAt ?? null,
      finalizedAt:
        needsFinalize ? serverTimestamp() : existingData?.finalizedAt ?? null,
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

    if (needsFinalize) {
      const itemsCol = collection(db, "sales", saleRef.id, "items");

      for (const row of activeItems) {
        const itemRef = doc(itemsCol);
        transaction.set(itemRef, {
          productId: row.productId,
          productName: row.productName || "",
          productSnapshot: row.productSnapshot || null,
          unit: row.unit || "",
          warehouseKey: row.warehouseKey || "main",
          quantity: round2(readNumber(row.quantity)),
          unitPrice: round2(readNumber(row.unitPrice)),
          discountRate: round2(readNumber(row.discountRate)),
          vatRate: saleType === "official" ? round2(readNumber(row.vatRate)) : 0,
          net: round2(readNumber(row.net)),
          vat: saleType === "official" ? round2(readNumber(row.vat)) : 0,
          total: round2(readNumber(row.total)),
          stockConsumption: Array.isArray(row.stockConsumption) ? row.stockConsumption : [],
          costBreakdown: Array.isArray(row.costBreakdown) ? row.costBreakdown : [],
          totalCost: round2(readNumber(row.totalCost)),
          profit: round2(readNumber(row.profit)),
        });
      }

      writeSaleStockMovements({
        transaction,
        saleId: saleRef.id,
        saleType,
        items: activeItems,
        saleChannel,
        invoiceNo,
        invoiceDate: invoiceDateISO,
      });

      writeStockBalancesAfterSale({
        transaction,
        items: activeItems,
        existingBalances,
      });

      if (cariId) {
        createCariTransaction(transaction, {
          cariId,
          direction: "debit",
          operationType: "sale_invoice",
          source: "sale",
          refId: saleRef.id,
          amount: totals.grossTotal,
          operationDate: invoiceDateISO,
          documentNo: invoiceNo,
          currency: "KZT",
          note: `Satis faturasi: ${invoiceNo}`,
        });

        if (paidAmount > 0) {
          await writeCashMovementTransaction(transaction, {
            kind: "collect",
            mode: "payment",
            cariId,
            amount: paidAmount,
            method: paymentMethod || "cash",
            accountId: defaultAccountId,
            operationDate: invoiceDateISO,
            invoiceId: saleRef.id,
            invoiceNo,
            invoiceKind: "sale",
            description: `Satis aninda tahsilat - ${invoiceNo}`,
          });
        }
      }
    }

    return { saleId: saleRef.id };
  });
}

export async function deleteDraftSale({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");

  return runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);

    if (!saleSnap.exists()) {
      throw new Error("Taslak satis bulunamadi");
    }

    const status = normalizeDocumentStatus(saleSnap.data()?.status, {
      fallback: "draft",
    });

    if (!isDraftStatus(status)) {
      throw new Error("Onayli satis taslak olarak silinemez");
    }

    transaction.delete(saleRef);
  });
}

async function reverseConfirmedSale({ saleId, movementType, markFields }) {
  const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Satis bulunamadi");

    const sale = saleSnap.data();
    if (!isConfirmedStatus(sale?.status)) return true;

    const saleType = sale.saleType === "actual" ? "actual" : "official";
    const reversalItems = buildSaleMovementRows(items.length > 0 ? items : sale.items || []);

    const existingBalances = await readStockBalancesForSale({
      transaction,
      items: reversalItems,
      saleType,
    });

    writeStockBalancesAfterReturn({
      transaction,
      items: reversalItems,
      existingBalances,
    });

    const stockCollection = collection(db, "stock_movements");
    for (const item of reversalItems) {
      const part = item.costBreakdown?.[0];
      const qty = round2(readNumber(part?.qty));
      if (!item.productId || !(qty > 0)) continue;

      const ref = doc(stockCollection);
      transaction.set(ref, {
        productId: item.productId,
        productName: item.productName || "",
        unit: item.unit || "",
        qty,
        type: movementType,
        saleId,
        saleType,
        bucket: part?.bucket === "official" ? "official" : "actual",
        warehouseKey: item.warehouseKey || "main",
        unitCost: round2(readNumber(part?.unitCost)),
        totalCost: round2(readNumber(part?.totalCost)),
        saleChannel: sale.saleChannel || sale.platformId || null,
        invoiceNo: sale.saleNo || sale.invoiceNo || "",
        documentDate: sale.documentDate?.toDate
          ? sale.documentDate.toDate()
          : sale.documentDate || null,
        createdAt: serverTimestamp(),
      });
    }

    if (sale.cariId) {
      const documentNo = sale.invoiceNo || sale.saleNo || null;
      const operationDate = sale.documentDate?.toDate
        ? sale.documentDate.toDate()
        : sale.documentDate || new Date();

      createCariTransaction(transaction, {
        cariId: sale.cariId,
        direction: "credit",
        operationType: "sale_cancel",
        source: "sale_cancel",
        refId: saleId,
        amount: round2(readNumber(sale.grossTotal)),
        operationDate,
        documentNo,
        currency: "KZT",
        note: `Satis iptali: ${documentNo || saleId}`,
      });

      const paidAmount = round2(readNumber(sale.payment?.paidAmount));
      if (paidAmount > 0) {
        createCariTransaction(transaction, {
          cariId: sale.cariId,
          direction: "debit",
          operationType: "sale_payment_cancel",
          source: "sale_payment_cancel",
          refId: saleId,
          amount: paidAmount,
          operationDate,
          documentNo,
          currency: "KZT",
          paymentMethod: sale.payment?.method || null,
          note: `Tahsilat iadesi: ${documentNo || saleId}`,
        });
      }
    }

    transaction.set(
      saleRef,
      {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...markFields,
      },
      { merge: true }
    );

    return true;
  });
}

export async function cancelSale({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");
  return reverseConfirmedSale({
    saleId,
    movementType: "sale_cancel",
    markFields: {},
  });
}

export async function returnSale({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");
  return reverseConfirmedSale({
    saleId,
    movementType: "sale_return",
    markFields: {
      returnedAt: serverTimestamp(),
    },
  });
}
