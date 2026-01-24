//app/satissitok/services/stockService.js
import {
  collection,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Satınalma sonrası stok hareketlerini oluşturur
 * Her ürün için +qty ledger kaydı
 */
export async function addPurchaseStockMovements({
  transaction,
  purchaseId,
  purchaseType,
  items,
}) {
  const stockCollection = collection(db, "stock_movements");

  items.forEach((item) => {
    if (!item.productId || !item.qty) return;

    const stockRef = doc(stockCollection);

    transaction.set(stockRef, {
      productId: item.productId,
      qty: Number(item.qty), // + stok
      type: "purchase",
      purchaseId,
      purchaseType, // official | actual
      createdAt: serverTimestamp(),
    });
  });
}
