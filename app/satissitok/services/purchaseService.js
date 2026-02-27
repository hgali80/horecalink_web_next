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

/* ===============================
   FATURA FORMAT (UI İLE AYNI)
   R-26-000001 / F-26-000001
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

function formatInvoiceNo(type, yy, seq) {
  const prefix = type === "official" ? "R" : "F";
  return `${prefix}-${yy}-${pad6(seq)}`;
}

function toDateOrNull(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* =========================================================
   CREATE PURCHASE (COUNTER + STATUS + UI FIELDS + CONDITIONED WRITES)
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

    // UI: kullanıcı inputa dokunmadıysa true gönderiyor
    const invoiceNoAuto = payload.invoiceNoAuto === true;

    /* =====================
       READ PHASE
    ===================== */

    // ✅ Sayaç her kayıt için tükecek (mevcut davranış korunuyor)
    const counterRef = doc(db, "counters", "purchases");
    const counterSnap = await transaction.get(counterRef);

    if (!counterSnap.exists()) {
      throw new Error("Sayaç bulunamadı: counters/purchases");
    }

    const data = counterSnap.data();
    const key = type === "official" ? "official" : "actual";

    const currentSeq = Number(data[key] || 0);
    const nextSeq = currentSeq + 1;

    // ✅ Auto invoice her zaman counter’dan üretilir
    const yy = year2FromDateISO(payload.documentDate);
    const autoInvoice = formatInvoiceNo(type, yy, nextSeq);

    // ✅ Kaydedilecek invoiceNo seçimi:
    // - invoiceNoAuto=true  => autoInvoice
    // - invoiceNoAuto=false => manualInvoice (boşsa autoInvoice)
    const invoiceNo = invoiceNoAuto ? autoInvoice : manualInvoice || autoInvoice;

    // ✅ Stok balance okumayı sadece completed için yap (draft/pending’de gereksiz)
    const existingBalances = isFinal
      ? await readStockBalancesForPurchase({
          transaction,
          items: payload.items || [],
        })
      : null;

    /* =====================
       WRITE PHASE
    ===================== */

    // ✅ Sayaç HER SATINALMADA güncellenecek (taslak dahil)
    transaction.update(counterRef, {
      [key]: nextSeq,
    });

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
      invoiceNoAuto, // audit

      // tarihler
      documentDate: toDateOrNull(payload.documentDate),

      // tür/depo/vergi
      purchaseType: type,
      warehouseKey,
      taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
      vatMode: type === "official" ? payload.vatMode || "inclusive" : null,

      // kalemler/toplam
      items: payload.items || [],
      totals: payload.totals || {},

      // ödeme/not/ek
      paymentMethod: (payload.paymentMethod || "").trim(), // bank | cash | kaspi (UI)
      dueDate: toDateOrNull(payload.dueDate),
      notes: (payload.notes || "").trim(),
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],

      status, // ✅ artık payload’dan geliyor

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
        items: payload.items || [],
        supplierName: (payload.supplierName || "").trim(),
        invoiceNo,
        documentDate: payload.documentDate || null,
        currency: "KZT",
        warehouseKey,
      });

      writeStockBalancesWithAvgCost({
        transaction,
        purchaseType: type,
        items: payload.items || [],
        existingBalances,
        warehouseKey,
      });
    }

    /* =====================
       CARİ HAREKETİ
       ✅ Sadece completed iken
    ===================== */

    if (isFinal && payload.supplierCariId) {
      const cariTxRef = doc(collection(db, "cari_transactions"));

      transaction.set(cariTxRef, {
        cariId: payload.supplierCariId,

        operationDate: toDateOrNull(payload.documentDate),
        dueDate: toDateOrNull(payload.dueDate),

        operationType: "purchase_invoice",
        operationCategory: payload.operationCategory || "trade_goods",

        documentNo: invoiceNo,

        debit: 0,
        credit: Number(payload.totals?.gross || 0),

        currency: "KZT",

        // ✅ UI notes/description uyumu
        description: (payload.description || payload.notes || "Satınalma faturası").trim(),

        createdAt: serverTimestamp(),
      });
    }

    return purchaseRef.id;
  });
}

/* =========================================================
   CANCEL PURCHASE (MINIMAL GÜNCELLEME: warehouseKey EKLENDİ)
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

    // ✅ Draft/Pending iptal ediliyorsa stok/cari ters kaydı yapma (çünkü yazılmamış olabilir)
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
        const cariTxRef = doc(collection(db, "cari_transactions"));

        transaction.set(cariTxRef, {
          cariId: purchase.supplierCariId,
          operationDate: new Date(),
          operationType: "purchase_cancel",
          documentNo: purchase.invoiceNo,
          debit: Number(purchase.totals?.gross || 0),
          credit: 0,
          currency: "KZT",
          description: "Satınalma faturası iptali",
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