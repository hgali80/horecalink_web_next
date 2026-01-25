// app/satissitok/services/purchaseService.js
import {
  collection,
  doc,
  serverTimestamp,
  runTransaction,
  addDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import { addPurchaseStockMovements } from "./stockService";

function formatDocumentNo(type, seq) {
  const year = new Date().getFullYear().toString().slice(-2);
  return `${type === "official" ? "R" : "F"}-${year}${String(seq).padStart(6, "0")}`;
}

export async function createPurchase(payload) {
  let purchaseId = null;

  // 1️⃣ SADECE SATINALMA + SAYAÇ TRANSACTION
  purchaseId = await runTransaction(db, async (transaction) => {
    const counterRef = doc(db, "purchase_counters", "main");
    const counterSnap = await transaction.get(counterRef);

    const counters = counterSnap.exists()
      ? counterSnap.data()
      : { official: 0, actual: 0 };

    const type = payload.purchaseType;
    const nextSeq = (counters[type] || 0) + 1;
    const documentNo = formatDocumentNo(type, nextSeq);

    transaction.set(
      counterRef,
      { [type]: nextSeq },
      { merge: true }
    );

    const purchaseRef = doc(collection(db, "purchases"));

    const purchaseData = {
      supplierName: payload.supplierName || "",
      documentNo,
      documentDate: payload.documentDate
        ? new Date(payload.documentDate)
        : null,

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
    };

    transaction.set(purchaseRef, purchaseData);

    return purchaseRef.id;
  });

  // 2️⃣ TRANSACTION DIŞINDA STOK HAREKETLERİ
  //await addPurchaseStockMovements({
  //  purchaseId,
  //  purchaseType: payload.purchaseType,
  //  items: payload.items,
 // });

  return purchaseId;
}
