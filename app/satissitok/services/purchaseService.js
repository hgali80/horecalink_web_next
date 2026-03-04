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

/* =========================================================
   CREATE PURCHASE
   ✅ FIX: Transaction rule (ALL READS before ANY WRITES)
   - Önce stok balance read (completed ise)
   - Sonra invoice counter reserve (read+write)
   - Sonra tüm write işlemleri
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

    // Depo (yeni model) – satınalma ekranında seçimi yoksa varsayılan: main
    const warehouseKey = (payload.warehouseKey || "main").trim() || "main";

    const manualInvoice = (payload.invoiceNo ?? payload.documentNo ?? "").trim();
    const invoiceNoAutoFlag = payload.invoiceNoAuto === true;

    const items = Array.isArray(payload.items) ? payload.items : [];

    /* =====================
       READ PHASE (ALL READS FIRST)
    ===================== */

    // ✅ Stok balance okumayı sadece completed için yap
    const existingBalances = isFinal
      ? await readStockBalancesForPurchase({
          transaction,
          items,
        })
      : null;

    // ✅ Sayaç reserve (read+write) — Bundan sonra read YOK!
    const { yy, nextSeq, autoInvoice } = await reserveNextInvoiceNo({
      transaction,
      kind: "purchases",
      type,
      dateISO: payload.documentDate,
    });

    // ✅ Kaydedilecek invoiceNo seçimi:
    // - invoiceNoAuto=true  => autoInvoice
    // - invoiceNoAuto=false => manualInvoice (boşsa autoInvoice)
    const invoiceNo = invoiceNoAutoFlag ? autoInvoice : manualInvoice || autoInvoice;

    // UI / audit
    const invoiceNoAutoValue = invoiceNo === autoInvoice ? autoInvoice : null;
    const invoiceNoManual = invoiceNo !== autoInvoice;

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
      invoiceNoAuto: invoiceNoAutoValue, // audit (auto üretilen no, yoksa null)
      invoiceNoManual, // audit (manuel müdahale oldu mu)
      invoiceSequence: nextSeq, // audit (yıl içi sıra)
      invoiceYear2: yy, // audit (YY)
      invoiceCounterRef: "invoice_counters/purchases", // audit

      // tarihler
      documentDate: toDateOrNull(payload.documentDate),

      // tür/depo/vergi
      purchaseType: type,
      warehouseKey,
      taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
      vatMode: type === "official" ? payload.vatMode || "inclusive" : null,

      // kalemler/toplam
      items,
      totals: payload.totals || {},

      // ödeme/not/ek
      paymentMethod: (payload.paymentMethod || "").trim(), // bank | cash | kaspi (UI)
      dueDate: toDateOrNull(payload.dueDate),
      notes: (payload.notes || "").trim(),
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],

      status,

      createdAt: serverTimestamp(),
    });

    /* =====================
       STOK HAREKETLERİ
       ✅ Sadece completed iken
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
       CARİ HAREKETİ
       ✅ Sadece completed iken
       ✅ CANONICAL + LEGACY birlikte yazılır (geriye uyum)
    ===================== */

    if (isFinal && payload.supplierCariId) {
      const gross = Number(payload.totals?.gross || 0);
      const desc = (payload.description || payload.notes || "Satınalma faturası").trim();

      const cariTxRef = doc(collection(db, "cari_transactions"));

      transaction.set(cariTxRef, {
        cariId: payload.supplierCariId,

        operationDate: toDateOrNull(payload.documentDate),
        dueDate: toDateOrNull(payload.dueDate),

        // ✅ canonical
        operationType: "purchase_invoice",
        direction: "credit",         // satınalma -> cariye alacak yazar
        amount: gross,               // tek alan raporlama için
        refId: purchaseRef.id,       // detaya link için
        documentNo: invoiceNo,
        note: desc,
        paymentMethod: (payload.paymentMethod || "").trim() || null,

        operationCategory: payload.operationCategory || "trade_goods",

        currency: "KZT",

        // ✅ legacy (kalsın, eski ekranlar bozulmasın)
        debit: 0,
        credit: gross,
        description: desc,

        // optional legacy alias (istersen raporda kullanma)
        source: "purchase",

        createdAt: serverTimestamp(),
      });
    }

    return purchaseRef.id;
  });
}

/* =========================================================
   CANCEL PURCHASE (MEVCUT YAPI KORUNDU)
   ✅ CANONICAL alanlar eklendi
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
        const gross = Number(purchase.totals?.gross || 0);
        const desc = "Satınalma faturası iptali";

        const cariTxRef = doc(collection(db, "cari_transactions"));

        transaction.set(cariTxRef, {
          cariId: purchase.supplierCariId,

          operationDate: new Date(),

          // ✅ canonical
          operationType: "purchase_cancel",
          direction: "debit",       // iptal -> cariden düşmek için borç yazar (ters kayıt)
          amount: gross,
          refId: purchaseId,
          documentNo: purchase.invoiceNo,
          note: desc,

          currency: "KZT",

          // ✅ legacy (kalsın)
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
    });

    return true;
  });
}