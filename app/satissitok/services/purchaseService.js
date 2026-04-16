import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  buildPurchaseCancellationPlan,
  readStockBalancesForPurchase,
  writePurchaseCancelStockMovements,
  writePurchaseStockMovements,
  writeStockBalancesAfterPurchaseCancel,
  writeStockBalancesWithAvgCost,
} from "./stockService";
import { reserveNextInvoiceNo } from "./invoiceCounterService";
import { getDefaultCashAccountId } from "./cashAccountService";
import { initializeSettlementFields } from "./documentSettlementService";
import { normalizeDocumentItemSnapshot } from "./inventoryCatalogService";
import { writePurchaseCostEntries } from "./inventoryCostService";
import { writeCashMovementTransaction } from "./financeService";
import {
  isConfirmedStatus,
  isDraftStatus,
  normalizeDocumentStatus,
} from "./documentFlow";
import { createCariTransaction } from "@/app/satissitok/admin/cari/services/cariService";

function toDateOrNull(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function normalizeItems(items) {
  return Array.isArray(items)
    ? items.map((row) => normalizeDocumentItemSnapshot(row))
    : [];
}

function buildTotals(payload, type) {
  const t = payload.totals || {};
  const net = round2(t.net ?? payload.netTotal ?? 0);
  const vatRaw = t.tax ?? t.vat ?? payload.vatTotal ?? payload.taxTotal ?? 0;
  const vat = round2(vatRaw);
  const gross = round2(t.gross ?? payload.grossTotal ?? payload.total ?? net + vat);

  return {
    totalsNormalized: {
      net,
      tax: vat,
      vat,
      gross,
    },
    net,
    vatTotal: type === "official" ? vat : 0,
    gross,
  };
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

function buildBasePurchaseData({
  payload,
  type,
  status,
  warehouseKey,
  items,
  totalsNormalized,
  net,
  vatTotal,
  gross,
}) {
  return {
    supplierName: (payload.supplierName || "").trim(),
    supplierCariId: payload.supplierCariId || null,
    supplierBin: (payload.supplierBin || "").trim(),
    supplierRef: (payload.supplierRef || "").trim(),
    responsiblePerson: (payload.responsiblePerson || "").trim(),
    documentDate: toDateOrNull(payload.documentDate),
    purchaseType: type,
    warehouseKey,
    taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
    vatMode: type === "official" ? payload.vatMode || "inclusive" : null,
    items,
    totals: totalsNormalized,
    netTotal: net,
    vatTotal,
    grossTotal: gross,
    settlementSummary: initializeSettlementFields({ invoiceAmount: gross }).settlementSummary,
    paymentMethod: (payload.paymentMethod || "").trim(),
    payment: payload.payment || null,
    dueDate: toDateOrNull(payload.dueDate),
    notes: (payload.notes || "").trim(),
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    status,
    isDraftLike: !isConfirmedStatus(status),
    updatedAt: serverTimestamp(),
  };
}

export async function createPurchase(payload) {
  const isPaidNow = payload?.payment?.isPaid === true || payload?.isPaid === true;
  const defaultAccountId = isPaidNow
    ? payload?.payment?.accountId || payload?.accountId || (await getDefaultCashAccountId())
    : null;

  if (isPaidNow && !defaultAccountId) {
    throw new Error("Pesin odeme icin varsayilan kasa/banka hesabi gerekli");
  }

  return runTransaction(db, async (transaction) => {
    const type = payload.purchaseType === "actual" ? "actual" : "official";
    const status = createStatusPayload({
      payloadStatus: payload?.status,
      existingStatus: null,
      fallback: "draft",
    });
    const isConfirmed = isConfirmedStatus(status);
    const warehouseKey = (payload.warehouseKey || "main").trim() || "main";
    const manualInvoice = (payload.invoiceNo ?? payload.documentNo ?? "").trim();
    const invoiceNoAutoFlag = payload.invoiceNoAuto === true;

    const items = normalizeItems(payload.items);
    const purchaseId = (payload.purchaseId || payload.id || "").trim();
    const isUpdate = !!purchaseId;

    const purchaseRef = isUpdate
      ? doc(db, "purchases", purchaseId)
      : doc(collection(db, "purchases"));

    const existingSnap = isUpdate ? await transaction.get(purchaseRef) : null;
    const existingData = existingSnap?.exists() ? existingSnap.data() : null;

    if (isUpdate && !existingData) {
      throw new Error("Guncellenecek satinalma kaydi bulunamadi");
    }

    const normalizedStatus = createStatusPayload({
      payloadStatus: payload?.status,
      existingStatus: existingData?.status,
      fallback: "draft",
    });
    const prevStatus = normalizeDocumentStatus(existingData?.status, { fallback: "draft" });
    const prevWasConfirmed = isConfirmedStatus(prevStatus);
    const needsFinalize = isConfirmedStatus(normalizedStatus) && !prevWasConfirmed;

    const existingBalances = needsFinalize
      ? await readStockBalancesForPurchase({
          transaction,
          items,
        })
      : null;

    let invoiceNo = existingData?.invoiceNo || null;
    let invoiceNoAutoValue = existingData?.invoiceNoAuto ?? null;
    let invoiceNoManual = !!existingData?.invoiceNoManual;
    let invoiceSequence = existingData?.invoiceSequence ?? null;
    let invoiceYear2 = existingData?.invoiceYear2 ?? null;
    let invoiceCounterRef = existingData?.invoiceCounterRef ?? null;

    if (isConfirmedStatus(normalizedStatus)) {
      if (!prevWasConfirmed || !invoiceNo) {
        const { yy, nextSeq, autoInvoice, counterRefPath } = await reserveNextInvoiceNo({
          transaction,
          kind: "purchases",
          type,
          dateISO: payload.documentDate,
        });

        invoiceNo = invoiceNoAutoFlag ? autoInvoice : manualInvoice || autoInvoice;
        invoiceNoAutoValue = invoiceNo === autoInvoice ? autoInvoice : null;
        invoiceNoManual = invoiceNo !== autoInvoice;
        invoiceSequence = nextSeq;
        invoiceYear2 = yy;
        invoiceCounterRef = counterRefPath;
      }
    } else {
      invoiceNo = null;
      invoiceNoAutoValue = null;
      invoiceNoManual = false;
      invoiceSequence = null;
      invoiceYear2 = null;
      invoiceCounterRef = null;
    }

    const { totalsNormalized, net, vatTotal, gross } = buildTotals(payload, type);

    const baseData = buildBasePurchaseData({
      payload,
      type,
      status: normalizedStatus,
      warehouseKey,
      items,
      totalsNormalized,
      net,
      vatTotal,
      gross,
    });

    const docData = {
      ...baseData,
      invoiceNo,
      documentNo: invoiceNo,
      invoiceNoAuto: invoiceNoAutoValue,
      invoiceNoManual,
      invoiceSequence,
      invoiceYear2,
      invoiceCounterRef,
      draftNo: null,
      draftSequence: null,
      draftYear2: null,
      draftCounterRef: null,
      approvedAt: needsFinalize ? serverTimestamp() : existingData?.approvedAt ?? null,
      finalizedAt: needsFinalize ? serverTimestamp() : existingData?.finalizedAt ?? null,
    };

    if (isUpdate) {
      transaction.set(purchaseRef, docData, { merge: true });
    } else {
      transaction.set(purchaseRef, {
        ...docData,
        createdAt: serverTimestamp(),
      });
    }

    if (needsFinalize) {
      writePurchaseStockMovements({
        transaction,
        purchaseId: purchaseRef.id,
        purchaseType: type,
        items,
        supplierName: (payload.supplierName || "").trim(),
        invoiceNo,
        documentDate: payload.documentDate || null,
        currency: "KZT",
        warehouseKey,
      });

      writeStockBalancesWithAvgCost({
        transaction,
        purchaseType: type,
        items,
        existingBalances,
        warehouseKey,
      });

      writePurchaseCostEntries({
        transaction,
        purchaseId: purchaseRef.id,
        purchaseType: type,
        supplierCariId: payload.supplierCariId || null,
        supplierName: (payload.supplierName || "").trim(),
        invoiceNo,
        documentDate: payload.documentDate || null,
        warehouseKey,
        items,
      });

      if (payload.supplierCariId) {
        const desc = (payload.description || payload.notes || "Satinalma faturasi").trim();
        createCariTransaction(transaction, {
          cariId: payload.supplierCariId,
          direction: "credit",
          operationType: "purchase_invoice",
          source: "purchase",
          refId: purchaseRef.id,
          amount: gross,
          operationDate: payload.documentDate,
          dueDate: payload.dueDate,
          documentNo: invoiceNo,
          paymentMethod: (payload.paymentMethod || "").trim() || null,
          currency: "KZT",
          note: desc,
        });
      }

      if (payload.supplierCariId && isPaidNow) {
        await writeCashMovementTransaction(transaction, {
          kind: "pay",
          mode: "payment",
          cariId: payload.supplierCariId,
          amount: gross,
          method: (payload.paymentMethod || payload?.payment?.method || "cash").trim() || "cash",
          accountId: defaultAccountId,
          operationDate:
            payload?.payment?.paidDate || payload?.paidDate || payload.documentDate || null,
          invoiceId: purchaseRef.id,
          invoiceNo,
          invoiceKind: "purchase",
          description: `Satinalma aninda odeme - ${invoiceNo}`,
        });
      }
    }

    return purchaseRef.id;
  });
}

export async function deleteDraftPurchase({ purchaseId }) {
  if (!purchaseId) throw new Error("purchaseId zorunlu");

  return runTransaction(db, async (transaction) => {
    const purchaseRef = doc(db, "purchases", purchaseId);
    const snap = await transaction.get(purchaseRef);

    if (!snap.exists()) {
      throw new Error("Taslak satinalma bulunamadi");
    }

    const status = normalizeDocumentStatus(snap.data()?.status, {
      fallback: "draft",
    });

    if (!isDraftStatus(status)) {
      throw new Error("Onayli satinalma taslak olarak silinemez");
    }

    transaction.delete(purchaseRef);
  });
}

export async function cancelPurchase({ purchaseId }) {
  if (!purchaseId) throw new Error("purchaseId zorunlu");

  return runTransaction(db, async (transaction) => {
    const purchaseRef = doc(db, "purchases", purchaseId);
    const snap = await transaction.get(purchaseRef);

    if (!snap.exists()) throw new Error("Satinalma bulunamadi");

    const purchase = snap.data();
    if (normalizeDocumentStatus(purchase.status, { fallback: "draft" }) === "cancelled") {
      return true;
    }

    const wasConfirmed = isConfirmedStatus(purchase.status);
    const items = normalizeItems(purchase.items);
    const type = purchase.purchaseType === "actual" ? "actual" : "official";

    if (wasConfirmed) {
      const operationDate = purchase.documentDate?.toDate
        ? purchase.documentDate.toDate()
        : purchase.documentDate || new Date();
      const existingBalances = await readStockBalancesForPurchase({
        transaction,
        items,
      });

      const plan = buildPurchaseCancellationPlan({
        purchaseType: type,
        items,
        existingBalances,
        warehouseKey: purchase.warehouseKey || "main",
      });

      if ((plan.stockErrors || []).length > 0) {
        throw new Error("Iptal icin yeterli stok yok. Bu alis daha sonra kullanilmis olabilir.");
      }

      writePurchaseCancelStockMovements({
        transaction,
        purchaseId: purchaseRef.id,
        purchaseType: type,
        items: plan.linePlans,
        supplierName: purchase.supplierName || "",
        invoiceNo: purchase.invoiceNo || "",
        documentDate: purchase.documentDate || null,
        currency: "KZT",
      });

      writeStockBalancesAfterPurchaseCancel({
        transaction,
        items: plan.linePlans,
        existingBalances,
      });

      if (purchase.supplierCariId) {
        const gross = round2(num(purchase.grossTotal ?? purchase.totals?.gross));
        const documentNo = purchase.invoiceNo || null;

        createCariTransaction(transaction, {
          cariId: purchase.supplierCariId,
          direction: "debit",
          operationType: "purchase_cancel",
          source: "purchase_cancel",
          refId: purchaseId,
          amount: gross,
          operationDate,
          documentNo,
          currency: "KZT",
          note: "Satinalma faturasi iptali",
        });
      }

      writePurchaseCostEntries({
        transaction,
        purchaseId,
        purchaseType: type,
        supplierCariId: purchase.supplierCariId || null,
        supplierName: purchase.supplierName || "",
        invoiceNo: purchase.invoiceNo || "",
        documentDate: operationDate,
        warehouseKey: purchase.warehouseKey || "main",
        items: plan.linePlans,
        entryType: "purchase_cancel",
      });
    }

    transaction.set(
      purchaseRef,
      {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  });
}
