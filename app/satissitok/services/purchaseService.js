//app/satissitok/services/purchaseService.js
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
      vatMode: payload.vatMode || "inclusive",
      taxRate: payload.taxRate || 0,

      items: (payload.items || []).map((item) => ({
        productId: item.productId,
        productName: item.productName || "",
        unit: item.unit || "",
        qty: Number(item.qty) || 0,

        // Kullanıcının girdiği birim fiyat (vatMode'a göre net/brüt anlamı var)
        unitPrice: Number(item.unitPrice) || 0,

        // Hesaplananlar
        netUnitPrice: Number(item.netUnitPrice) || 0,
        vatUnitPrice: Number(item.vatUnitPrice) || 0,
        grossUnitPrice: Number(item.grossUnitPrice) || 0,

        netLineTotal: Number(item.netLineTotal) || 0,
        vatLineTotal: Number(item.vatLineTotal) || 0,
        grossLineTotal: Number(item.grossLineTotal) || 0,

        // Geriye dönük uyumluluk (bazı yerlerde lineTotal kullanılıyor olabilir)
        lineTotal: Number(item.grossLineTotal) || 0,
      })),

      totals: payload.totals, // { net, tax, gross }
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
