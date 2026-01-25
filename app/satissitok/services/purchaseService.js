// app/satissitok/services/purchaseService.js
import {
  collection,
  doc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/firebase";
import { addPurchaseStockMovements } from "./stockService";

/**
 * Evrak numarası üretir
 * R-26000001 / F-26000001
 */
function formatDocumentNo(type, seq) {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = type === "official" ? "R" : "F";
  return `${prefix}-${year}${String(seq).padStart(6, "0")}`;
}

/**
 * ISO tarih güvenli parse
 */
function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function createPurchase(payload) {
  // 🔒 purchaseType doğrulama
  const rawType = String(payload.purchaseType || "").trim();
  if (!["official", "actual"].includes(rawType)) {
    throw new Error("Geçersiz purchaseType");
  }
  const type = rawType;

  // 1️⃣ TRANSACTION: sayaç + purchase
  const purchaseId = await runTransaction(db, async (transaction) => {
    // Sayaç
    const counterRef = doc(db, "purchase_counters", "main");
    const counterSnap = await transaction.get(counterRef);

    const counters = counterSnap.exists()
      ? counterSnap.data()
      : { official: 0, actual: 0 };

    const nextSeq = Number(counters[type] || 0) + 1;
    const documentNo = formatDocumentNo(type, nextSeq);

    transaction.set(
      counterRef,
      { [type]: nextSeq },
      { merge: true }
    );

    // Purchase belgesi
    const purchaseRef = doc(collection(db, "purchases"));

    transaction.set(purchaseRef, {
      supplierName: payload.supplierName || "",
      documentNo,
      documentDate: safeDate(payload.documentDate),

      purchaseType: type,
      taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
      vatMode: type === "official" ? payload.vatMode || "inclusive" : null,

      items: (payload.items || []).map((item) => ({
        productId: item.productId,
        productName: item.productName || "",
        unit: item.unit || "",
        qty: Number(item.qty) || 0,

        unitPrice: Number(item.unitPrice) || 0,

        netUnitPrice: Number(item.netUnitPrice) || 0,
        vatUnitPrice: Number(item.vatUnitPrice) || 0,
        grossUnitPrice: Number(item.grossUnitPrice) || 0,

        netLineTotal: Number(item.netLineTotal) || 0,
        vatLineTotal: Number(item.vatLineTotal) || 0,
        grossLineTotal: Number(item.grossLineTotal) || 0,
      })),

      totals: {
        net: Number(payload.totals?.net || 0),
        tax: Number(payload.totals?.tax || 0),
        gross: Number(payload.totals?.gross || 0),
      },

      createdAt: serverTimestamp(),
    });

    return purchaseRef.id;
  });

  // 2️⃣ TRANSACTION DIŞI: stok hareketleri
  await addPurchaseStockMovements({
    purchaseId,
    purchaseType: type,
    items: payload.items,
  });

  return purchaseId;
}
