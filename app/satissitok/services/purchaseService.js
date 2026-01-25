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

function formatInvoiceNo(type, seq) {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = type === "official" ? "R" : "F";
  return `${prefix}-${year}${String(seq).padStart(6, "0")}`;
}

export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    const type = payload.purchaseType;

    // 🔵 invoiceNo / documentNo uyumu
    let invoiceNo = (payload.invoiceNo ?? payload.documentNo ?? "").trim();

    // =====================
    // READ PHASE
    // =====================

    // sayaç oku
    let nextSeq = null;
    if (!invoiceNo) {
      const counterRef = doc(db, "purchase_counters", "main");
      const counterSnap = await transaction.get(counterRef);

      const counters = counterSnap.exists()
        ? counterSnap.data()
        : { official: 0, actual: 0 };

      nextSeq = (counters[type] || 0) + 1;
      invoiceNo = formatInvoiceNo(type, nextSeq);
    }

    // stock balances oku
    const existingBalances =
      await readStockBalancesForPurchase({
        transaction,
        items: payload.items || [],
      });

    // =====================
    // WRITE PHASE
    // =====================

    if (nextSeq !== null) {
      const counterRef = doc(db, "purchase_counters", "main");
      transaction.set(
        counterRef,
        { [type]: nextSeq },
        { merge: true }
      );
    }

    const purchaseRef = doc(collection(db, "purchases"));

    transaction.set(purchaseRef, {
      supplierName: payload.supplierName || "",
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

      createdAt: serverTimestamp(),
    });

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

    return purchaseRef.id;
  });
}
