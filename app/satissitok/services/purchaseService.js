//app/satissitok/services/purchaseService.js
import {
  collection,
  addDoc,
  doc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/firebase";
import { addPurchaseStockMovements } from "./stockService";

/**
 * Satınalma oluşturur
 * - purchases koleksiyonuna yazar
 * - stock_movements koleksiyonuna +stok yazar
 */
export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    // 1️⃣ Satınalma belgesi oluştur
    const purchaseRef = doc(collection(db, "purchases"));

    const purchaseData = {
      supplierName: payload.supplierName,
      documentNo: payload.documentNo || "",
      documentDate: payload.documentDate
        ? new Date(payload.documentDate)
        : null,
      purchaseType: payload.purchaseType, // official | actual
      taxRate: payload.taxRate || 0,
      items: payload.items.map((item) => ({
        productId: item.productId,
        qty: Number(item.qty),
        unitCost: Number(item.unitCost),
        lineTotal: Number(item.lineTotal),
      })),
      totals: payload.totals,
      createdAt: serverTimestamp(),
    };

    transaction.set(purchaseRef, purchaseData);

    // 2️⃣ Stok hareketlerini ekle (+qty)
    await addPurchaseStockMovements({
      transaction,
      purchaseId: purchaseRef.id,
      purchaseType: payload.purchaseType,
      items: payload.items,
    });

    return purchaseRef.id;
  });
}
