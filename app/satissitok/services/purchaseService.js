// app/satissitok/services/purchaseService.js
import {
  collection,
  doc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  readStockBalancesForPurchase,
  writePurchaseStockMovements,
  writeStockBalancesWithAvgCost,
} from "./stockService";

import { reserveNextInvoiceNo } from "./invoiceCounterService";

/* ===============================
   FATURA FORMAT (UI İLE AYNI)
   PR-26-000001 / PF-26-000001
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

/* =========================================================
   CREATE PURCHASE
   ✅ FIX: Transaction rule (ALL READS before ANY WRITES)
========================================================= */

export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    const type = payload.purchaseType; // official | actual
    if (type !== "official" && type !== "actual") {
      throw new Error("purchaseType geçersiz: official | actual olmalı");
    }

    // ✅ UI status: draft | pending | completed
    const status = (payload.status || "completed").trim() || "completed";
    const isFinal = status === "completed";

    // Depo – satınalma ekranında seçimi yoksa varsayılan: main
    const warehouseKey = (payload.warehouseKey || "main").trim() || "main";

    const manualInvoice = (payload.invoiceNo ?? payload.documentNo ?? "").trim();
    const invoiceNoAutoFlag = payload.invoiceNoAuto === true;

    const items = Array.isArray(payload.items) ? payload.items : [];

    /* =====================
       READ PHASE (ALL READS FIRST)
    ===================== */

    const existingBalances = isFinal
      ? await readStockBalancesForPurchase({
          transaction,
          items,
        })
      : null;

    // ✅ Sayaç reserve — Bundan sonra read YOK!
    const { yy, nextSeq, autoInvoice } = await reserveNextInvoiceNo({
      transaction,
      kind: "purchases",
      type,
      dateISO: payload.documentDate,
    });

    const invoiceNo = invoiceNoAutoFlag ? autoInvoice : manualInvoice || autoInvoice;

    // UI / audit
    const invoiceNoAutoValue = invoiceNo === autoInvoice ? autoInvoice : null;
    const invoiceNoManual = invoiceNo !== autoInvoice;

    /* =====================
       TOTALS NORMALIZATION (VAT REPORT READY)
       UI: totals = { net, tax, gross }
       Legacy: totals.vat olabilir
    ===================== */

    const t = payload.totals || {};
    const net = round2(t.net ?? payload.netTotal ?? 0);
    const vatRaw = t.tax ?? t.vat ?? payload.vatTotal ?? payload.taxTotal ?? 0;
    const vat = round2(vatRaw);
    const gross = round2(t.gross ?? payload.grossTotal ?? payload.total ?? (net + vat));

    // purchaseType=actual ise rapor KDV’si 0 olmalı
    const vatTotal = type === "official" ? vat : 0;

    // totals objesini geriye uyumlu yaz (tax + vat birlikte)
    const totalsNormalized = {
      net,
      tax: vat, // UI mevcut ana anahtar
      vat: vat, // rapor/legacy uyumu için alias
      gross,
    };

    /* =====================
       WRITE PHASE
    ===================== */

    const purchaseRef = doc(collection(db, "purchases"));

    transaction.set(purchaseRef, {
      // tedarikçi
      supplierName: (payload.supplierName || "").trim(),
      supplierCariId: payload.supplierCariId || null,

      // ✅ yeni alanlar
      supplierBin: (payload.supplierBin || "").trim(),
      supplierRef: (payload.supplierRef || "").trim(),
      responsiblePerson: (payload.responsiblePerson || "").trim(),

      // fatura
      invoiceNo,
      documentNo: invoiceNo,
      invoiceNoAuto: invoiceNoAutoValue,
      invoiceNoManual,
      invoiceSequence: nextSeq,
      invoiceYear2: yy,
      invoiceCounterRef: "invoice_counters/purchases",

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

      // ✅ RAPOR İÇİN TOP-LEVEL TOTALS
      netTotal: net,
      vatTotal: vatTotal,
      grossTotal: gross,

      // ödeme/not/ek
      paymentMethod: (payload.paymentMethod || "").trim(),
      payment: payload.payment || null,
      dueDate: toDateOrNull(payload.dueDate),
      notes: (payload.notes || "").trim(),
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],

      status,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    /* =====================
       STOK HAREKETLERİ — Sadece completed
    ===================== */

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

    /* =====================
       CARİ HAREKETİ — Sadece completed
       ✅ CANONICAL + LEGACY birlikte yazılır
    ===================== */

    if (isFinal && payload.supplierCariId) {
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