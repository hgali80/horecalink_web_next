//app/satissitok/services/stockService.js
import {
  collection,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

const DEFAULT_WAREHOUSE_KEY = "main";

function safeWarehouseKey(k) {
  return (k || DEFAULT_WAREHOUSE_KEY).trim() || DEFAULT_WAREHOUSE_KEY;
}

function getBucketFromDocData(docData, warehouseKey, bucketKey) {
  const wh = safeWarehouseKey(warehouseKey);
  const warehouses = docData?.warehouses || {};

  // New model
  const bucket = warehouses?.[wh]?.[bucketKey];
  if (bucket && (bucket.qty !== undefined || bucket.avgCost !== undefined)) {
    return {
      qty: Number(bucket.qty) || 0,
      avgCost: Number(bucket.avgCost) || 0,
    };
  }

  // Legacy fallback (no warehouses)
  const legacy = docData?.[bucketKey] || {};
  return {
    qty: Number(legacy.qty) || 0,
    avgCost: Number(legacy.avgCost) || 0,
  };
}

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
  warehouseKey,
}) {
  const stockCollection = collection(db, "stock_movements");
  const whKey = safeWarehouseKey(warehouseKey);

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

      warehouseKey: whKey,

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
  warehouseKey,
}) {
  const bucketKey = purchaseType === "official" ? "official" : "actual";
  const whKey = safeWarehouseKey(warehouseKey);

  for (const item of items || []) {
    if (!item?.productId) continue;

    const inQty = Number(item.qty) || 0;
    if (!inQty) continue;

    const unitCost =
      Number(item.netUnitPrice ?? item.unitPrice ?? 0) || 0;

    const docData = existingBalances[item.productId] || {};
    const prev = getBucketFromDocData(docData, whKey, bucketKey);
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
        warehouses: {
          [whKey]: {
            [bucketKey]: {
              qty: newQty,
              avgCost: newAvg,
              updatedAt: serverTimestamp(),
            },
          },
        },
      },
      { merge: true }
    );
  }
}

/**
 * READ PHASE
 * Satış öncesi stok kontrolü ve avgCost okuma
 *
 * KRİTİK KURAL:
 * - official satışta official bucket okunur
 * - actual satışta normalde actual bucket okunur
 * - ancak actual qty <= 0 ve official avgCost > 0 ise
 *   maliyet official avgCost'tan fallback alınır
 *
 * Böylece:
 * - resmi alınıp fiili satılan ürünlerde
 * - fiili stok boşken maliyet 0 çıkmaz
 * - kar hesaplaması bozulmaz
 */
export async function readStockBalancesForSale({
  transaction,
  items,
  saleType, // "official" | "actual"
}) {
  const map = {};

  for (const item of items || []) {
    if (!item?.productId) continue;

    const whKey = safeWarehouseKey(item.warehouseKey);
    const key = `${item.productId}__${whKey}`;
    if (map[key]) continue;

    const ref = doc(db, "stock_balances", item.productId);
    const snap = await transaction.get(ref);
    const data = snap.exists() ? snap.data() : {};

    const officialBucket = getBucketFromDocData(data, whKey, "official");
    const actualBucket = getBucketFromDocData(data, whKey, "actual");

    if (saleType === "official") {
      map[key] = {
        qty: Number(officialBucket.qty) || 0,
        avgCost: Number(officialBucket.avgCost) || 0,
        costSource: "official",
        fallbackOfficialAvgCost: Number(officialBucket.avgCost) || 0,
      };
      continue;
    }

    const actualQty = Number(actualBucket.qty) || 0;
    const actualAvgCost = Number(actualBucket.avgCost) || 0;
    const officialAvgCost = Number(officialBucket.avgCost) || 0;

    const shouldUseOfficialFallback =
      actualQty <= 0 && officialAvgCost > 0;

    map[key] = {
      qty: actualQty,
      avgCost: shouldUseOfficialFallback ? officialAvgCost : actualAvgCost,
      costSource: shouldUseOfficialFallback ? "official_fallback" : "actual",
      fallbackOfficialAvgCost: officialAvgCost,
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

      warehouseKey: safeWarehouseKey(item.warehouseKey),

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

  // aynı üründen birden çok satır olabilir → aggregate (product+warehouse)
  const outByKey = {};
  for (const item of items || []) {
    if (!item?.productId) continue;
    const whKey = safeWarehouseKey(item.warehouseKey);
    const q = Number(item.quantity || 0);
    if (!q) continue;
    const k = `${item.productId}__${whKey}`;
    outByKey[k] = (outByKey[k] || 0) + q;
  }

  for (const [compoundKey, outQty] of Object.entries(outByKey)) {
    const [productId, whKey] = compoundKey.split("__");
    const prev = existingBalances?.[compoundKey] || { qty: 0, avgCost: 0 };
    const oldQty = Number(prev.qty) || 0;

    // negatif stoğa izin var
    const newQty = oldQty - Number(outQty || 0);

    const ref = doc(db, "stock_balances", productId);
    transaction.set(
      ref,
      {
        warehouses: {
          [whKey]: {
            [bucketKey]: {
              qty: newQty,
              avgCost: Number(prev.avgCost) || 0, // satışta avg değişmez
              updatedAt: serverTimestamp(),
            },
          },
        },
      },
      { merge: true }
    );
  }
}

/**
 * WRITE PHASE
 * Satış iade / iptal sonrası stok geri ekleme
 *
 * DÜZELTME:
 * - warehouse bazlı çalışır
 * - compound key: productId__warehouseKey
 * - mevcut avgCost korunur
 * - warehouses.{wh}.{bucket} modeline yazar
 */
export function writeStockBalancesAfterReturn({
  transaction,
  saleType,
  items,
  existingBalances,
}) {
  const bucketKey = saleType === "official" ? "official" : "actual";

  // aynı üründen birden çok satır olabilir → aggregate (product+warehouse)
  const inByKey = {};
  for (const item of items || []) {
    if (!item?.productId) continue;

    const whKey = safeWarehouseKey(item.warehouseKey);
    const q = Number(item.quantity || 0);
    if (!q) continue;

    const k = `${item.productId}__${whKey}`;
    inByKey[k] = (inByKey[k] || 0) + q;
  }

  for (const [compoundKey, inQty] of Object.entries(inByKey)) {
    const [productId, whKey] = compoundKey.split("__");
    const prev = existingBalances?.[compoundKey] || { qty: 0, avgCost: 0 };
    const oldQty = Number(prev.qty) || 0;

    const newQty = oldQty + Number(inQty || 0);

    const ref = doc(db, "stock_balances", productId);
    transaction.set(
      ref,
      {
        warehouses: {
          [whKey]: {
            [bucketKey]: {
              qty: newQty,
              avgCost: Number(prev.avgCost) || 0,
              updatedAt: serverTimestamp(),
            },
          },
        },
      },
      { merge: true }
    );
  }
}