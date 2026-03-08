// app/satissitok/services/purchaseService.js
import {
  collection,
  doc,
  serverTimestamp,
  runTransaction,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  readStockBalancesForPurchase,
  writePurchaseStockMovements,
  writeStockBalancesWithAvgCost,
} from "./stockService";

import {
  reserveNextInvoiceNo,
  reserveNextDraftNo,
} from "./invoiceCounterService";

/* ===============================
   FATURA FORMAT
   Final: PR-26-000001 / PF-26-000001
   Draft: PD-26-000001
================================ */

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

function normalizeStatus(status) {
  const s = String(status || "completed").trim().toLowerCase();
  if (s === "draft" || s === "pending" || s === "completed" || s === "cancelled") {
    return s;
  }
  return "completed";
}

function normalizeItems(items) {
  return Array.isArray(items) ? items : [];
}

function buildTotals(payload, type) {
  const t = payload.totals || {};
  const net = round2(t.net ?? payload.netTotal ?? 0);
  const vatRaw = t.tax ?? t.vat ?? payload.vatTotal ?? payload.taxTotal ?? 0;
  const vat = round2(vatRaw);
  const gross = round2(t.gross ?? payload.grossTotal ?? payload.total ?? net + vat);

  const vatTotal = type === "official" ? vat : 0;

  return {
    totalsNormalized: {
      net,
      tax: vat,
      vat,
      gross,
    },
    net,
    vat,
    vatTotal,
    gross,
  };
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
    // tedarikçi
    supplierName: (payload.supplierName || "").trim(),
    supplierCariId: payload.supplierCariId || null,

    // ek alanlar
    supplierBin: (payload.supplierBin || "").trim(),
    supplierRef: (payload.supplierRef || "").trim(),
    responsiblePerson: (payload.responsiblePerson || "").trim(),

    // tarihler
    documentDate: toDateOrNull(payload.documentDate),

    // tür/depo/vergi
    purchaseType: type,
    warehouseKey,
    taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
    vatMode: type === "official" ? payload.vatMode || "inclusive" : null,

    // kalemler/toplam
    items,
    totals: totalsNormalized,

    // top-level totals
    netTotal: net,
    vatTotal,
    grossTotal: gross,

    // ödeme/not/ek
    paymentMethod: (payload.paymentMethod || "").trim(),
    payment: payload.payment || null,
    dueDate: toDateOrNull(payload.dueDate),
    notes: (payload.notes || "").trim(),
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],

    // durum
    status,
    isDraftLike: status !== "completed",

    updatedAt: serverTimestamp(),
  };
}

/* =========================================================
   CREATE / UPDATE PURCHASE
   - draft/pending => no stock, no avg cost, no cari movement
   - completed     => normal final flow
========================================================= */

export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    const type = payload.purchaseType; // official | actual
    if (type !== "official" && type !== "actual") {
      throw new Error("purchaseType geçersiz: official | actual olmalı");
    }

    const status = normalizeStatus(payload.status || "completed");
    const isFinal = status === "completed";

    // Depo – satınalma ekranında seçimi yoksa varsayılan: main
    const warehouseKey = (payload.warehouseKey || "main").trim() || "main";

    const manualInvoice = (payload.invoiceNo ?? payload.documentNo ?? "").trim();
    const invoiceNoAutoFlag = payload.invoiceNoAuto === true;

    const items = normalizeItems(payload.items);
    const purchaseId = (payload.purchaseId || payload.id || "").trim();
    const isUpdate = !!purchaseId;

    /* =====================
       READ PHASE (ALL READS FIRST)
    ===================== */

    const purchaseRef = isUpdate
      ? doc(db, "purchases", purchaseId)
      : doc(collection(db, "purchases"));

    const existingSnap = isUpdate ? await transaction.get(purchaseRef) : null;
    const existingData = existingSnap?.exists() ? existingSnap.data() : null;

    if (isUpdate && !existingData) {
      throw new Error("Güncellenecek satınalma kaydı bulunamadı");
    }

    const prevStatus = normalizeStatus(existingData?.status || "draft");
    const prevWasFinal = prevStatus === "completed";

    // Draft/pending -> completed geçişinde stok read gerekir
    // Yeni completed kayıtta da gerekir
    const needsStockRead = isFinal && !prevWasFinal;

    const existingBalances = needsStockRead
      ? await readStockBalancesForPurchase({
          transaction,
          items,
        })
      : null;

    let invoiceNo = "";
    let invoiceNoAutoValue = null;
    let invoiceNoManual = false;
    let invoiceSequence = existingData?.invoiceSequence ?? null;
    let invoiceYear2 = existingData?.invoiceYear2 ?? null;
    let invoiceCounterRef = existingData?.invoiceCounterRef ?? null;

    let draftNo = existingData?.draftNo ?? null;
    let draftSequence = existingData?.draftSequence ?? null;
    let draftYear2 = existingData?.draftYear2 ?? null;
    let draftCounterRef = existingData?.draftCounterRef ?? null;

    // FINAL BELGE
    if (isFinal) {
      if (prevWasFinal && existingData?.invoiceNo) {
        // Zaten final belgeyse numara korunur
        invoiceNo = String(existingData.invoiceNo || "").trim();
        invoiceNoAutoValue = existingData.invoiceNoAuto ?? null;
        invoiceNoManual = !!existingData.invoiceNoManual;
      } else {
        // Yeni final kayıt ya da draft -> final dönüşümü
        const { yy, nextSeq, autoInvoice } = await reserveNextInvoiceNo({
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
        invoiceCounterRef = "invoice_counters/purchases";
      }
    } else {
      // DRAFT / PENDING
      if (existingData?.draftNo) {
        // Mevcut taslak güncelleniyor, draft no korunur
        invoiceNo = existingData.draftNo;
        draftNo = existingData.draftNo;
        draftSequence = existingData?.draftSequence ?? null;
        draftYear2 = existingData?.draftYear2 ?? null;
        draftCounterRef = existingData?.draftCounterRef ?? "draft_counters/purchases";
      } else {
        // Yeni taslak numarası üret
        const { yy, nextSeq, autoDraftNo } = await reserveNextDraftNo({
          transaction,
          kind: "purchases",
          dateISO: payload.documentDate,
        });

        invoiceNo = autoDraftNo;
        draftNo = autoDraftNo;
        draftSequence = nextSeq;
        draftYear2 = yy;
        draftCounterRef = "draft_counters/purchases";
      }

      invoiceNoAutoValue = null;
      invoiceNoManual = false;

      // completed olmayan kayıtta normal invoice sequence tutulmaz
      invoiceSequence = null;
      invoiceYear2 = null;
      invoiceCounterRef = null;
    }

    /* =====================
       TOTALS NORMALIZATION
    ===================== */

    const { totalsNormalized, net, vatTotal, gross } = buildTotals(payload, type);

    /* =====================
       WRITE PHASE
    ===================== */

    const baseData = buildBasePurchaseData({
      payload,
      type,
      status,
      warehouseKey,
      items,
      totalsNormalized,
      net,
      vatTotal,
      gross,
    });

    const docData = {
      ...baseData,

      // fatura
      invoiceNo,
      documentNo: invoiceNo,
      invoiceNoAuto: invoiceNoAutoValue,
      invoiceNoManual,
      invoiceSequence,
      invoiceYear2,
      invoiceCounterRef,

      // draft info
      draftNo,
      draftSequence,
      draftYear2,
      draftCounterRef,

      // finalize info
      approvedAt:
        status === "completed" && !prevWasFinal ? serverTimestamp() : existingData?.approvedAt ?? null,
      finalizedAt:
        status === "completed" && !prevWasFinal ? serverTimestamp() : existingData?.finalizedAt ?? null,
    };

    if (isUpdate) {
      transaction.update(purchaseRef, docData);
    } else {
      transaction.set(purchaseRef, {
        ...docData,
        createdAt: serverTimestamp(),
      });
    }

    /* =====================
       STOK HAREKETLERİ
       Sadece finalleşme anında
    ===================== */

    if (needsStockRead) {
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

    /* =====================
       CARİ HAREKETİ
       Sadece finalleşme anında
    ===================== */

    if (needsStockRead && payload.supplierCariId) {
      const desc = (payload.description || payload.notes || "Satınalma faturası").trim();
      const cariTxRef = doc(collection(db, "cari_transactions"));

      transaction.set(cariTxRef, {
        cariId: payload.supplierCariId,

        operationDate: toDateOrNull(payload.documentDate),
        dueDate: toDateOrNull(payload.dueDate),

        // canonical
        operationType: "purchase_invoice",
        direction: "credit",
        amount: gross,
        refId: purchaseRef.id,
        documentNo: invoiceNo,
        note: desc,
        paymentMethod: (payload.paymentMethod || "").trim() || null,
        operationCategory: payload.operationCategory || "trade_goods",
        currency: "KZT",

        // legacy
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

/* =========================================================
   DELETE DRAFT PURCHASE
   - Sadece draft / pending silinir
   - completed kayıt burada silinmez
========================================================= */

export async function deleteDraftPurchase({ purchaseId }) {
  if (!purchaseId) throw new Error("purchaseId zorunlu");

  const purchaseRef = doc(db, "purchases", purchaseId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(purchaseRef);

    if (!snap.exists()) {
      throw new Error("Taslak satınalma bulunamadı");
    }

    const purchase = snap.data();
    const status = normalizeStatus(purchase?.status || "draft");

    if (status === "completed") {
      throw new Error("Tamamlanmış satınalma taslak olarak silinemez");
    }

    transaction.delete(purchaseRef);
  });

  return true;
}

/* =========================================================
   CANCEL PURCHASE (MEVCUT YAPI KORUNDU)
========================================================= */

export async function cancelPurchase({ purchaseId }) {
  if (!purchaseId) throw new Error("purchaseId zorunlu");

  return await runTransaction(db, async (transaction) => {
    const purchaseRef = doc(db, "purchases", purchaseId);
    const snap = await transaction.get(purchaseRef);

    if (!snap.exists()) throw new Error("Satınalma bulunamadı");

    const purchase = snap.data();
    if (purchase.status === "cancelled") return true;

    const items = purchase.items || [];
    const type = purchase.purchaseType;

    const wasFinal = purchase.status === "completed";

    const existingBalances = wasFinal
      ? await readStockBalancesForPurchase({
          transaction,
          items,
        })
      : null;

    if (wasFinal) {
      writePurchaseStockMovements({
        transaction,
        purchaseId: purchaseRef.id,
        purchaseType: type,
        items,
        supplierName: purchase.supplierName || "",
        invoiceNo: purchase.invoiceNo,
        documentDate: purchase.documentDate || null,
        currency: "KZT",
        warehouseKey: purchase.warehouseKey || "main",
        reverse: true,
      });

      writeStockBalancesWithAvgCost({
        transaction,
        purchaseType: type,
        items,
        existingBalances,
        warehouseKey: purchase.warehouseKey || "main",
        reverse: true,
      });

      if (purchase.supplierCariId) {
        const gross = Number(purchase.grossTotal ?? purchase.totals?.gross ?? 0);
        const desc = "Satınalma faturası iptali";

        const cariTxRef = doc(collection(db, "cari_transactions"));

        transaction.set(cariTxRef, {
          cariId: purchase.supplierCariId,
          operationDate: new Date(),

          // canonical
          operationType: "purchase_cancel",
          direction: "debit",
          amount: gross,
          refId: purchaseId,
          documentNo: purchase.invoiceNo,
          note: desc,
          currency: "KZT",

          // legacy
          debit: gross,
          credit: 0,
          description: desc,
          source: "purchase_cancel",

          createdAt: serverTimestamp(),
        });
      }
    }

    transaction.update(purchaseRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return true;
  });
}