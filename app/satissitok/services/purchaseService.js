// app/satissitok/services/purchaseService.js
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  readStockBalancesForPurchase,
  writePurchaseStockMovements,
  writeStockBalancesWithAvgCost,
} from "./stockService";

import { reserveNextDraftNo, reserveNextInvoiceNo } from "./invoiceCounterService";

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

export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    const type = payload.purchaseType === "actual" ? "actual" : "official";
    const status = ["draft", "pending", "completed"].includes(payload.status)
      ? payload.status
      : "draft";
    const isFinal = status === "completed";
    const warehouseKey = (payload.warehouseKey || "main").trim() || "main";
    const items = Array.isArray(payload.items) ? payload.items : [];
    const manualInvoice = (payload.invoiceNo ?? payload.documentNo ?? "").trim();
    const purchaseRef = payload.purchaseId
      ? doc(db, "purchases", payload.purchaseId)
      : doc(collection(db, "purchases"));

    const existingSnap = payload.purchaseId ? await transaction.get(purchaseRef) : null;
    const existing = existingSnap?.exists() ? existingSnap.data() : null;
    if (existing?.status === "completed") {
      throw new Error("Tamamlanmış satınalma taslak olarak güncellenemez.");
    }

    const existingBalances = isFinal
      ? await readStockBalancesForPurchase({ transaction, items })
      : null;

    let invoiceNo = manualInvoice || null;
    let invoiceSequence = existing?.invoiceSequence || null;
    let invoiceYear2 = existing?.invoiceYear2 || null;
    let invoiceCounterRef = existing?.invoiceCounterRef || null;
    let draftNo = existing?.draftNo || null;
    let draftSequence = existing?.draftSequence || null;
    let draftYear2 = existing?.draftYear2 || null;
    let draftCounterRef = existing?.draftCounterRef || null;
    let invoiceNoAutoValue = null;
    let invoiceNoManual = Boolean(manualInvoice);

    if (isFinal) {
      const reserved = await reserveNextInvoiceNo({
        transaction,
        kind: "purchases",
        type,
        dateISO: payload.documentDate,
      });
      invoiceNo = payload.invoiceNoAuto === true ? reserved.autoInvoice : manualInvoice || reserved.autoInvoice;
      invoiceSequence = reserved.nextSeq;
      invoiceYear2 = reserved.yy;
      invoiceCounterRef = reserved.counterRefPath;
      invoiceNoAutoValue = invoiceNo === reserved.autoInvoice ? reserved.autoInvoice : null;
      invoiceNoManual = invoiceNo !== reserved.autoInvoice;
    } else {
      if (!draftNo) {
        const reservedDraft = await reserveNextDraftNo({
          transaction,
          kind: "purchases",
          dateISO: payload.documentDate,
        });
        draftNo = reservedDraft.draftNo;
        draftSequence = reservedDraft.nextSeq;
        draftYear2 = reservedDraft.yy;
        draftCounterRef = reservedDraft.counterRefPath;
      }
      invoiceNo = draftNo;
      invoiceSequence = null;
      invoiceYear2 = draftYear2;
      invoiceCounterRef = draftCounterRef;
      invoiceNoAutoValue = draftNo;
      invoiceNoManual = false;
    }

    const t = payload.totals || {};
    const net = round2(t.net ?? payload.netTotal ?? 0);
    const vatRaw = t.tax ?? t.vat ?? payload.vatTotal ?? payload.taxTotal ?? 0;
    const vat = round2(vatRaw);
    const gross = round2(t.gross ?? payload.grossTotal ?? payload.total ?? (net + vat));
    const vatTotal = isFinal && type === "official" ? vat : 0;

    const totalsNormalized = {
      net,
      tax: vat,
      vat,
      gross,
    };

    transaction.set(
      purchaseRef,
      {
        supplierName: (payload.supplierName || "").trim(),
        supplierCariId: payload.supplierCariId || null,
        supplierBin: (payload.supplierBin || "").trim(),
        supplierRef: (payload.supplierRef || "").trim(),
        responsiblePerson: (payload.responsiblePerson || "").trim(),

        invoiceNo,
        documentNo: invoiceNo,
        invoiceNoAuto: invoiceNoAutoValue,
        invoiceNoManual,
        invoiceSequence,
        invoiceYear2,
        invoiceCounterRef,

        draftNo,
        draftSequence,
        draftYear2,
        draftCounterRef,
        isDraftLike: !isFinal,
        approvedAt: isFinal ? serverTimestamp() : null,
        finalizedAt: isFinal ? serverTimestamp() : null,

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

        paymentMethod: (payload.paymentMethod || "").trim(),
        payment: payload.payment || null,
        dueDate: toDateOrNull(payload.dueDate),
        notes: (payload.notes || "").trim(),
        attachments: Array.isArray(payload.attachments) ? payload.attachments : [],

        status,
        createdAt: existing ? existing.createdAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (isFinal) {
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
    }

    if (isFinal && payload.supplierCariId) {
      const desc = (payload.description || payload.notes || "Satınalma faturası").trim();
      const cariTxRef = doc(collection(db, "cari_transactions"));

      transaction.set(cariTxRef, {
        cariId: payload.supplierCariId,
        operationDate: toDateOrNull(payload.documentDate),
        dueDate: toDateOrNull(payload.dueDate),
        operationType: "purchase_invoice",
        direction: "credit",
        amount: gross,
        refId: purchaseRef.id,
        documentNo: invoiceNo,
        note: desc,
        paymentMethod: (payload.paymentMethod || "").trim() || null,
        operationCategory: payload.operationCategory || "trade_goods",
        currency: "KZT",
        debit: 0,
        credit: gross,
        description: desc,
        source: "purchase",
        createdAt: serverTimestamp(),
      });
    }

    return purchaseRef.id;
  });
}

export async function deletePurchaseDraft({ purchaseId }) {
  if (!purchaseId) throw new Error("purchaseId zorunlu");
  const ref = doc(db, "purchases", purchaseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Taslak bulunamadı");
  const data = snap.data();
  if (data.status === "completed") {
    throw new Error("Tamamlanmış satınalma kaydı silinemez.");
  }
  await deleteDoc(ref);
  return true;
}

export async function cancelPurchase({ purchaseId }) {
  if (!purchaseId) throw new Error("purchaseId zorunlu");
  return await runTransaction(db, async (transaction) => {
    const purchaseRef = doc(db, "purchases", purchaseId);
    const snap = await transaction.get(purchaseRef);
    if (!snap.exists()) throw new Error("Satınalma bulunamadı");
    const purchase = snap.data();
    if (purchase.status !== "completed") {
      transaction.set(purchaseRef, { status: "cancelled", updatedAt: serverTimestamp() }, { merge: true });
      return true;
    }
    throw new Error("Bu sürümde sadece taslak/pending silme planlandı. Completed iptal mantığını mevcut dosyanızdan taşıyın.");
  });
}
