//app/satissitok/services/stockService.js
import {
  collection,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

/**
 * READ PHASE
 * Gerekli stock_balances dokümanlarını okur
 */
export async function readStockBalancesForPurchase({
  transaction,
  items,
}) {
  const map = {};

  for (const item of items || []) {
    if (!item?.productId) continue;
    if (map[item.productId]) continue;

    const ref = doc(db, "stock_balances", item.productId);
    const snap = await transaction.get(ref);

    map[item.productId] = snap.exists() ? snap.data() : {};
  }

  return map;
}

/**
 * WRITE PHASE
 * Satınalma stok hareketlerini yazar
 */
export function writePurchaseStockMovements({
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
    const unitCost =
      Number(item.netUnitPrice ?? item.unitPrice ?? 0) || 0;

    const totalCost = Math.round(qty * unitCost * 100) / 100;

    const ref = doc(stockCollection);

    transaction.set(ref, {
      productId: item.productId,
      productName: item.productName || "",
      unit: item.unit || "",

      qty,
      type: "purchase",
      purchaseId,
      purchaseType,

      unitCost,
      totalCost,
      currency,

      supplierName: supplierName || "",
      invoiceNo: invoiceNo || "",
      documentDate: documentDate ? new Date(documentDate) : null,

      createdAt: serverTimestamp(),
    });
  });
}

/**
 * WRITE PHASE
 * Ortalama maliyet (weighted average)
 * official / actual ayrı havuz
 */
export function writeStockBalancesWithAvgCost({
  transaction,
  purchaseType,
  items,
  existingBalances,
}) {
  const bucketKey = purchaseType === "official" ? "official" : "actual";

  for (const item of items || []) {
    if (!item?.productId) continue;

    const inQty = Number(item.qty) || 0;
    if (!inQty) continue;

    const unitCost =
      Number(item.netUnitPrice ?? item.unitPrice ?? 0) || 0;

    const prev = existingBalances[item.productId]?.[bucketKey] || {};
    const oldQty = Number(prev.qty) || 0;
    const oldAvg = Number(prev.avgCost) || 0;

    const newQty = oldQty + inQty;

    let newAvg = 0;
    if (newQty > 0) {
      newAvg =
        (oldQty * oldAvg + inQty * unitCost) / newQty;
    }

    newAvg = Math.round(newAvg * 100) / 100;

    const ref = doc(db, "stock_balances", item.productId);

    transaction.set(
      ref,
      {
        [bucketKey]: {
          qty: newQty,
          avgCost: newAvg,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );
  }
}

/**
 * READ PHASE
 * Satış öncesi stok kontrolü ve avgCost okuma
 */
export async function readStockBalancesForSale({
  transaction,
  items,
  saleType, // "official" | "actual"
}) {
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
export function writeSaleStockMovements({
  transaction,
  saleId,
  saleType,
  items,
  saleChannel,
  invoiceNo,
  invoiceDate,
}) {
  const bucketKey = saleType === "official" ? "official" : "actual";
  const stockCollection = collection(db, "stock_movements");

  items.forEach((item) => {
    if (!item.productId || !item.quantity) return;

    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return;

    const unitCost = Number(item.costAtSale || 0);
    const totalCost = Math.round(qty * unitCost * 100) / 100;

    const ref = doc(stockCollection);

    transaction.set(ref, {
      productId: item.productId,
      productName: item.productName || "",
      unit: item.unit || "",

      qty: -qty, // 🔴 satış = negatif

      type: "sale",
      saleId,
      saleType,
      bucket: bucketKey,

      unitCost,
      totalCost,
      currency: "KZT",

      saleChannel: saleChannel || null,
      invoiceNo: invoiceNo || "",
      documentDate: invoiceDate ? new Date(invoiceDate) : null,

      createdAt: serverTimestamp(),
    });
  });
}

/**
 * WRITE PHASE
 * Satış sonrası stok düş (NEGATİF STOĞA İZİN VAR)
 */
export function writeStockBalancesAfterSale({
  transaction,
  saleType,
  items,
  existingBalances,
}) {
  const bucketKey = saleType === "official" ? "official" : "actual";

  // 🔒 aynı üründen birden çok satır olabilir → aggregate
  const outByProduct = {};
  for (const item of items || []) {
    if (!item?.productId) continue;
    const q = Number(item.quantity || 0);
    if (!q) continue;
    outByProduct[item.productId] = (outByProduct[item.productId] || 0) + q;
  }

  for (const [productId, outQty] of Object.entries(outByProduct)) {
    const prev = existingBalances?.[productId] || {};
    const oldQty = Number(prev.qty) || 0;

    // 🔴 NEGATİF STOĞA İZİN VAR (UYARI UI'DA)
    const newQty = oldQty - Number(outQty || 0);

    const ref = doc(db, "stock_balances", productId);
    transaction.set(
      ref,
      {
        [bucketKey]: {
          qty: newQty,
          avgCost: prev.avgCost || 0, // satışta avg değişmez
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
export function writeStockBalancesAfterReturn({
  transaction,
  saleType,
  items,
  existingBalances,
}) {
  const bucketKey = saleType === "official" ? "official" : "actual";

  // 🔒 aynı üründen birden çok satır olabilir → aggregate
  const inByProduct = {};
  for (const item of items || []) {
    if (!item?.productId) continue;
    const q = Number(item.quantity || 0);
    if (!q) continue;
    inByProduct[item.productId] = (inByProduct[item.productId] || 0) + q;
  }

  for (const [productId, qty] of Object.entries(inByProduct)) {
    const prev = existingBalances?.[productId] || {};
    const oldQty = Number(prev.qty) || 0;

    const newQty = oldQty + Number(qty || 0);

    const ref = doc(db, "stock_balances", productId);
    transaction.set(
      ref,
      {
        [bucketKey]: {
          qty: newQty,
          avgCost: prev.avgCost || 0,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );
  }
}
