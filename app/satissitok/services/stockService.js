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
  supplierName,
  invoiceNo,
  documentDate,
  currency = "KZT",
}) {
  const stockCollection = collection(db, "stock_movements");

  items.forEach((item) => {
    if (!item.productId || !item.qty) return;

    const qty = Number(item.qty) || 0;

    // NET maliyet (KDV hariç) — PurchaseItemsTable zaten netUnitPrice hesaplıyor
    const unitCost = Number(
      item.netUnitPrice ?? item.unitPrice ?? 0
    ) || 0;

    const totalCost = Math.round(qty * unitCost * 100) / 100;

    const stockRef = doc(stockCollection);

    transaction.set(stockRef, {
      productId: item.productId,
      productName: item.productName || "",
      unit: item.unit || "",

      qty: Number(item.qty), // + stok
      type: "purchase",
      purchaseId,
      purchaseType, // official | actual

      // 🔥 Maliyet + meta (sonradan rapor/ekstre için)
      unitCost,            // NET birim maliyet
      totalCost,           // qty * unitCost
      currency,

      supplierName: supplierName || "",
      invoiceNo: invoiceNo || "",
      documentDate: documentDate ? new Date(documentDate) : null,

      createdAt: serverTimestamp(),
    });
  });
}

/**
 * Satınalma sonrası stok özetini günceller (weighted average cost)
 * Resmi ve Fiili ayrı havuz: stock_balances/{productId}.{official|actual}
 */
export async function applyPurchaseToStockBalances({
  transaction,
  purchaseType, // official | actual
  items,
}) {
  const bucketKey = purchaseType === "official" ? "official" : "actual";

  for (const item of items || []) {
    if (!item?.productId) continue;

    const inQty = Number(item.qty) || 0;
    if (!inQty) continue;

    const unitCost = Number(item.netUnitPrice ?? item.unitPrice ?? 0) || 0;

    const balanceRef = doc(db, "stock_balances", item.productId);
    const balanceSnap = await transaction.get(balanceRef);
    const balanceData = balanceSnap.exists() ? balanceSnap.data() : {};

    const bucket = balanceData?.[bucketKey] || {};
    const oldQty = Number(bucket.qty) || 0;
    const oldAvg = Number(bucket.avgCost) || 0;

    const newQty = oldQty + inQty;

    // Weighted Average:
    // newAvg = (oldQty*oldAvg + inQty*unitCost) / newQty
    let newAvg = 0;
    if (newQty > 0) {
      newAvg = (oldQty * oldAvg + inQty * unitCost) / newQty;
    } else {
      newAvg = 0;
    }

    // rounding (2 decimals)
    newAvg = Math.round(newAvg * 100) / 100;

    transaction.set(
      balanceRef,
      {
        [bucketKey]: {
          qty: newQty,
          avgCost: newAvg,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );

    // İstersen toplam stok görebilmek için genel alanlar da yazabiliriz (opsiyonel).
    // Şimdilik dokunmuyoruz.
  }
}
