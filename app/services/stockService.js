// app/satissitok/services/stockService.js
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * READ PHASE
 * Satış öncesi stok kontrolü ve avgCost okuma
 */
export async function readStockBalancesForSale({ transaction, items, saleType }) {
  const map = {};
  const bucketKey = saleType === "official" ? "official" : "actual";

  for (const item of items || []) {
    if (!item?.productId) continue;
    if (map[item.productId]) continue;

    const ref = doc(db, "stock_balances", item.productId);
    const snap = await transaction.get(ref);

    const data = snap.exists() ? snap.data() : {};
    const bucket = data[bucketKey] || {};

    map[item.productId] = {
      qty: Number(bucket.qty) || 0,
      avgCost: Number(bucket.avgCost) || 0,
    };
  }

  return map;
}

/**
 * WRITE PHASE
 * Satış stok hareketleri (negatif qty)
 */
export function writeSaleStockMovements({ transaction, saleId, saleType, items }) {
  const bucketKey = saleType === "official" ? "official" : "actual";
  const stockCollection = collection(db, "stock_movements");

  items.forEach((item) => {
    if (!item.productId || !item.quantity) return;

    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return;

    const ref = doc(stockCollection);

    transaction.set(ref, {
      productId: item.productId,
      productName: item.productName || "",
      unit: item.unit || "",

      qty: -qty,
      type: "sale",
      saleId,
      saleType,
      bucket: bucketKey,

      unitCost: Number(item.costAtSale || 0),
      totalCost: Math.round(qty * Number(item.costAtSale || 0) * 100) / 100,

      createdAt: serverTimestamp(),
    });
  });
}

/**
 * WRITE PHASE
 * Satış sonrası stok düş (NEGATİF SERBEST ✅)
 */
export function writeStockBalancesAfterSale({ transaction, saleType, items, saleBalances }) {
  const bucketKey = saleType === "official" ? "official" : "actual";

  for (const item of items || []) {
    if (!item.productId) continue;

    const outQty = Number(item.quantity) || 0;
    if (!outQty) continue;

    const prev = saleBalances[item.productId] || {};
    const oldQty = Number(prev.qty) || 0;

    // ✅ negatif stok serbest: kontrol yok
    const newQty = oldQty - outQty;

    const ref = doc(db, "stock_balances", item.productId);
    transaction.set(
      ref,
      {
        [bucketKey]: {
          qty: newQty,
          avgCost: Number(prev.avgCost) || 0,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );
  }
}

/**
 * WRITE PHASE
 * Satış iade / iptal sonrası stok geri ekleme
 */
export function writeStockBalancesAfterReturn({ transaction, saleType, items, saleBalances }) {
  const bucketKey = saleType === "official" ? "official" : "actual";

  for (const item of items || []) {
    if (!item.productId) continue;

    const qty = Number(item.quantity) || 0;
    if (!qty) continue;

    const prev = saleBalances[item.productId] || {};
    const oldQty = Number(prev.qty) || 0;

    const newQty = oldQty + qty;

    const ref = doc(db, "stock_balances", item.productId);
    transaction.set(
      ref,
      {
        [bucketKey]: {
          qty: newQty,
          avgCost: Number(prev.avgCost) || 0,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );
  }
}
