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
   FATURA FORMAT (AYNEN KORUNDU)
================================ */
function formatInvoiceNo(type, seq) {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = type === "official" ? "R" : "F";
  return `${prefix}-${year}${String(seq).padStart(6, "0")}`;
}

/* =========================================================
   CREATE PURCHASE (MINIMUM MÜDAHALE)
========================================================= */

export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    const type = payload.purchaseType; // official | actual

    let invoiceNo = (payload.invoiceNo ?? payload.documentNo ?? "").trim();
    let nextSeq = null;

    /* =====================
       READ PHASE
    ===================== */

    // 🔵 OTOMATİK FATURA NUMARASI
    if (!invoiceNo) {
      const counterId =
        type === "official"
          ? "purchases_official"
          : "purchases_actual";

      const counterRef = doc(db, "counters", counterId);
      const counterSnap = await transaction.get(counterRef);

      if (!counterSnap.exists()) {
        throw new Error(`Sayaç bulunamadı: counters/${counterId}`);
      }

      const currentSeq = Number(counterSnap.data()?.seq || 0);
      nextSeq = currentSeq + 1;

      invoiceNo = formatInvoiceNo(type, nextSeq);
    }

    const existingBalances =
      await readStockBalancesForPurchase({
        transaction,
        items: payload.items || [],
      });

    /* =====================
       WRITE PHASE
    ===================== */

    // 🔵 SAYAÇ GÜNCELLE (SADECE OTOMATİKTE)
    if (nextSeq !== null) {
      const counterId =
        type === "official"
          ? "purchases_official"
          : "purchases_actual";

      const counterRef = doc(db, "counters", counterId);
      transaction.update(counterRef, { seq: nextSeq });
    }

    const purchaseRef = doc(collection(db, "purchases"));

    transaction.set(purchaseRef, {
      supplierName: payload.supplierName || "",
      supplierCariId: payload.supplierCariId || null,

      invoiceNo,
      documentNo: invoiceNo,

      documentDate: payload.documentDate
        ? new Date(payload.documentDate)
        : null,

      purchaseType: type,
      taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
      vatMode: type === "official" ? payload.vatMode || "inclusive" : null,

      items: payload.items || [],
      totals: payload.totals || {},

      status: "completed",

      createdAt: serverTimestamp(),
    });

    /* =====================
       STOK HAREKETLERİ
    ===================== */

    writePurchaseStockMovements({
      transaction,
      purchaseId: purchaseRef.id,
      purchaseType: type,
      items: payload.items || [],
      supplierName: payload.supplierName || "",
      invoiceNo,
      documentDate: payload.documentDate || null,
      currency: "KZT",
    });

    writeStockBalancesWithAvgCost({
      transaction,
      purchaseType: type,
      items: payload.items || [],
      existingBalances,
    });

    /* =====================
       CARİ HAREKETİ
    ===================== */

    if (payload.supplierCariId) {
      const cariTxRef = doc(collection(db, "cari_transactions"));

      transaction.set(cariTxRef, {
        cariId: payload.supplierCariId,

        operationDate: payload.documentDate
          ? new Date(payload.documentDate)
          : null,

        dueDate: null,

        operationType: "purchase_invoice",
        operationCategory:
          payload.operationCategory || "trade_goods",

        documentNo: invoiceNo,

        debit: 0,
        credit: Number(payload.totals?.gross || 0),

        currency: "KZT",

        description:
          payload.description || "Satınalma faturası",

        createdAt: serverTimestamp(),
      });
    }

    return purchaseRef.id;
  });
}

/* =========================================================
   CANCEL PURCHASE (HİÇ DOKUNULMADI)
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

    const existingBalances =
      await readStockBalancesForPurchase({
        transaction,
        items,
      });

    writePurchaseStockMovements({
      transaction,
      purchaseId,
      purchaseType: type,
      items,
      supplierName: purchase.supplierName || "",
      invoiceNo: purchase.invoiceNo,
      documentDate: purchase.documentDate || null,
      currency: "KZT",
      reverse: true,
    });

    writeStockBalancesWithAvgCost({
      transaction,
      purchaseType: type,
      items,
      existingBalances,
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

    transaction.update(purchaseRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
    });

    return true;
  });
}
