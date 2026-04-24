import { collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

const DEFAULT_WAREHOUSE_KEY = "main";

function safeWarehouseKey(k) {
  return (k || DEFAULT_WAREHOUSE_KEY).trim() || DEFAULT_WAREHOUSE_KEY;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function getBucketFromDocData(docData, warehouseKey, bucketKey) {
  const wh = safeWarehouseKey(warehouseKey);
  const warehouses = docData?.warehouses || {};

  const bucket = warehouses?.[wh]?.[bucketKey];
  if (bucket && (bucket.qty !== undefined || bucket.avgCost !== undefined)) {
    return {
      qty: Number(bucket.qty) || 0,
      avgCost: Number(bucket.avgCost) || 0,
    };
  }

  const legacy = docData?.[bucketKey] || {};
  return {
    qty: Number(legacy.qty) || 0,
    avgCost: Number(legacy.avgCost) || 0,
  };
}

function getAllBucketsFromDocData(docData, warehouseKey) {
  return {
    actual: getBucketFromDocData(docData, warehouseKey, "actual"),
    official: getBucketFromDocData(docData, warehouseKey, "official"),
  };
}

export async function readStockBalancesForPurchase({ transaction, items }) {
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
    const unitCost = Number(item.netUnitPrice ?? item.unitPrice ?? 0) || 0;
    const totalCost = round2(qty * unitCost);

    const ref = doc(stockCollection);
    transaction.set(ref, {
      productId: item.productId,
      productName: item.productName || "",
      unit: item.unit || "",
      qty,
      type: "purchase",
      purchaseId,
      purchaseType,
      bucket: purchaseType === "official" ? "official" : "actual",
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

    const unitCost = Number(item.netUnitPrice ?? item.unitPrice ?? 0) || 0;
    const docData = existingBalances[item.productId] || {};
    const prev = getBucketFromDocData(docData, whKey, bucketKey);
    const oldQty = Number(prev.qty) || 0;
    const oldAvg = Number(prev.avgCost) || 0;
    const newQty = oldQty + inQty;

    let newAvg = 0;
    if (newQty > 0) {
      newAvg = (oldQty * oldAvg + inQty * unitCost) / newQty;
    }

    const ref = doc(db, "stock_balances", item.productId);
    transaction.set(
      ref,
      {
        warehouses: {
          [whKey]: {
            [bucketKey]: {
              qty: newQty,
              avgCost: round2(newAvg),
              updatedAt: serverTimestamp(),
            },
          },
        },
      },
      { merge: true }
    );
  }
}

export function buildPurchaseCancellationPlan({
  purchaseType,
  items,
  existingBalances,
  warehouseKey,
}) {
  const bucketKey = purchaseType === "official" ? "official" : "actual";
  const whKey = safeWarehouseKey(warehouseKey);
  const stockErrors = [];
  const linePlans = [];

  for (const item of items || []) {
    if (!item?.productId) continue;

    const qty = round2(Number(item.qty ?? item.quantity ?? 0));
    if (!(qty > 0)) continue;

    const docData = existingBalances?.[item.productId] || {};
    const bucketState = getBucketFromDocData(docData, whKey, bucketKey);
    const availableQty = round2(Number(bucketState.qty || 0));

    if (availableQty < qty) {
      stockErrors.push({
        productId: item.productId,
        warehouseKey: whKey,
        bucket: bucketKey,
        requested: qty,
        available: availableQty,
        reason: "insufficient_purchase_cancel_stock",
      });
      continue;
    }

    const unitCost = round2(
      Number(item.netUnitPrice ?? item.unitPrice ?? bucketState.avgCost ?? 0)
    );

    linePlans.push({
      ...item,
      warehouseKey: whKey,
      stockConsumption: [
        {
          bucket: bucketKey,
          qty,
          unitCost,
        },
      ],
      costBreakdown: [
        {
          bucket: bucketKey,
          qty,
          unitCost,
          totalCost: round2(qty * unitCost),
        },
      ],
      totalCost: round2(qty * unitCost),
    });
  }

  return { linePlans, stockErrors };
}

export function writePurchaseCancelStockMovements({
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
    const parts = Array.isArray(item.stockConsumption) ? item.stockConsumption : [];

    parts.forEach((part) => {
      const qty = Number(part.qty || 0);
      if (!item.productId || qty <= 0) return;

      const bucket = part.bucket === "official" ? "official" : "actual";
      const unitCost = Number(part.unitCost ?? 0);
      const totalCost = round2(qty * unitCost);

      const ref = doc(stockCollection);
      transaction.set(ref, {
        productId: item.productId,
        productName: item.productName || "",
        unit: item.unit || "",
        qty: -qty,
        type: "purchase_cancel",
        purchaseId,
        purchaseType,
        bucket,
        warehouseKey: safeWarehouseKey(item.warehouseKey),
        unitCost,
        totalCost,
        currency,
        supplierName: supplierName || "",
        invoiceNo: invoiceNo || "",
        documentDate: documentDate ? new Date(documentDate) : null,
        createdAt: serverTimestamp(),
      });
    });
  });
}

export function writeStockBalancesAfterPurchaseCancel({
  transaction,
  items,
  existingBalances,
}) {
  const outByKey = {};

  for (const item of items || []) {
    const parts = Array.isArray(item.stockConsumption)
      ? item.stockConsumption
      : Array.isArray(item.costBreakdown)
      ? item.costBreakdown
      : [];

    for (const part of parts) {
      if (!item?.productId) continue;
      const whKey = safeWarehouseKey(item.warehouseKey);
      const qty = Number(part.qty || 0);
      if (!qty) continue;
      const bucketKey = part.bucket === "official" ? "official" : "actual";
      const compoundKey = `${item.productId}__${whKey}__${bucketKey}`;
      outByKey[compoundKey] = round2((outByKey[compoundKey] || 0) + qty);
    }
  }

  for (const [compoundKey, outQty] of Object.entries(outByKey)) {
    const [productId, whKey, bucketKey] = compoundKey.split("__");
    const bucketState = getBucketFromDocData(
      existingBalances?.[productId] || {},
      whKey,
      bucketKey
    );

    const newQty = round2(Number(bucketState.qty || 0) - Number(outQty || 0));
    const ref = doc(db, "stock_balances", productId);
    transaction.set(
      ref,
      {
        warehouses: {
          [whKey]: {
            [bucketKey]: {
              qty: newQty,
              avgCost: Number(bucketState.avgCost) || 0,
              updatedAt: serverTimestamp(),
            },
          },
        },
      },
      { merge: true }
    );
  }
}

export async function readStockBalancesForSale({ transaction, items, saleType }) {
  const map = {};

  for (const item of items || []) {
    if (!item?.productId) continue;

    const whKey = safeWarehouseKey(item.warehouseKey);
    const key = `${item.productId}__${whKey}`;
    if (map[key]) continue;

    const ref = doc(db, "stock_balances", item.productId);
    const snap = await transaction.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const buckets = getAllBucketsFromDocData(data, whKey);

    map[key] = {
      qty:
        saleType === "official"
          ? Number(buckets.official.qty) || 0
          : Number(buckets.actual.qty) || 0,
      avgCost:
        saleType === "official"
          ? Number(buckets.official.avgCost) || 0
          : Number(buckets.actual.avgCost) || 0,
      costSource: saleType === "official" ? "official" : "actual",
      fallbackOfficialAvgCost: Number(buckets.official.avgCost) || 0,
      buckets: {
        actual: {
          qty: Number(buckets.actual.qty) || 0,
          avgCost: Number(buckets.actual.avgCost) || 0,
        },
        official: {
          qty: Number(buckets.official.qty) || 0,
          avgCost: Number(buckets.official.avgCost) || 0,
        },
      },
    };
  }

  return map;
}

export function buildSaleStockPlan({ saleType, items, existingBalances }) {
  const linePlans = [];
  const stockErrors = [];
  const bucketTotals = {};

  for (const row of items || []) {
    if (!row?.productId) continue;

    const quantity = Number(row.quantity || 0);
    if (!(quantity > 0)) continue;

    const warehouseKey = safeWarehouseKey(row.warehouseKey);
    const key = `${row.productId}__${warehouseKey}`;
    const balance = existingBalances?.[key] || {};
    const buckets = balance.buckets || {
      actual: { qty: 0, avgCost: 0 },
      official: { qty: 0, avgCost: 0 },
    };

    const requestedPlan = Array.isArray(row.stockConsumption)
      ? row.stockConsumption
      : Array.isArray(row.costBreakdown)
      ? row.costBreakdown
      : [];

    let allocations = [];

    if (requestedPlan.length > 0) {
      allocations = requestedPlan
        .map((part) => ({
          bucket: part?.bucket === "official" ? "official" : "actual",
          qty: Number(part?.qty || 0),
        }))
        .filter((part) => part.qty > 0);
    } else if (saleType === "official") {
      allocations = [{ bucket: "official", qty: quantity }];
    } else {
      const actualQty = Number(buckets.actual?.qty || 0);
      const officialQty = Number(buckets.official?.qty || 0);

      if (actualQty + officialQty < quantity) {
        stockErrors.push({
          productId: row.productId,
          warehouseKey,
          requested: quantity,
          availableActual: actualQty,
          availableOfficial: officialQty,
          reason: "insufficient_total_stock",
        });
      }

      const actualUsed = Math.min(actualQty, quantity);
      const officialUsed = quantity - actualUsed;
      if (actualUsed > 0) allocations.push({ bucket: "actual", qty: actualUsed });
      if (officialUsed > 0) allocations.push({ bucket: "official", qty: officialUsed });
    }

    const allocatedQty = round2(
      allocations.reduce((sum, part) => sum + Number(part.qty || 0), 0)
    );
    if (allocatedQty !== round2(quantity)) {
      stockErrors.push({
        productId: row.productId,
        warehouseKey,
        requested: quantity,
        allocatedQty,
        reason: "allocation_mismatch",
      });
      continue;
    }

    for (const part of allocations) {
      const bucket = part.bucket === "official" ? "official" : "actual";
      const available = Number(buckets[bucket]?.qty || 0);
      const aggregateKey = `${row.productId}__${warehouseKey}__${bucket}`;
      bucketTotals[aggregateKey] = round2((bucketTotals[aggregateKey] || 0) + part.qty);

      if (bucketTotals[aggregateKey] > available) {
        stockErrors.push({
          productId: row.productId,
          warehouseKey,
          bucket,
          requested: bucketTotals[aggregateKey],
          available,
          reason: "insufficient_bucket_stock",
        });
      }
    }

    const costBreakdown = allocations.map((part) => {
      const bucket = part.bucket === "official" ? "official" : "actual";
      const unitCost = round2(Number(buckets[bucket]?.avgCost || 0));
      return {
        bucket,
        qty: round2(part.qty),
        unitCost,
        totalCost: round2(part.qty * unitCost),
      };
    });

    linePlans.push({
      ...row,
      warehouseKey,
      stockConsumption: costBreakdown.map((part) => ({
        bucket: part.bucket,
        qty: part.qty,
        unitCost: part.unitCost,
      })),
      costBreakdown,
      totalCost: round2(costBreakdown.reduce((sum, part) => sum + part.totalCost, 0)),
    });
  }

  return { linePlans, stockErrors };
}

export function writeSaleStockMovements({
  transaction,
  saleId,
  saleType,
  items,
  saleChannel,
  invoiceNo,
  invoiceDate,
}) {
  const stockCollection = collection(db, "stock_movements");

  items.forEach((item) => {
    const parts = Array.isArray(item.stockConsumption) ? item.stockConsumption : [];

    parts.forEach((part) => {
      const qty = Number(part.qty || 0);
      if (!item.productId || qty <= 0) return;

      const bucket = part.bucket === "official" ? "official" : "actual";
      const unitCost = Number(part.unitCost ?? 0);
      const totalCost = round2(qty * unitCost);

      const ref = doc(stockCollection);
      transaction.set(ref, {
        productId: item.productId,
        productName: item.productName || "",
        unit: item.unit || "",
        qty: -qty,
        type: "sale",
        saleId,
        saleType,
        bucket,
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
  });
}

export function writeStockBalancesAfterSale({
  transaction,
  items,
  existingBalances,
}) {
  const outByKey = {};

  for (const item of items || []) {
    const parts = Array.isArray(item.stockConsumption) ? item.stockConsumption : [];
    for (const part of parts) {
      if (!item?.productId) continue;
      const whKey = safeWarehouseKey(item.warehouseKey);
      const q = Number(part.qty || 0);
      if (!q) continue;
      const bucket = part.bucket === "official" ? "official" : "actual";
      const k = `${item.productId}__${whKey}__${bucket}`;
      outByKey[k] = (outByKey[k] || 0) + q;
    }
  }

  for (const [compoundKey, outQty] of Object.entries(outByKey)) {
    const [productId, whKey, bucketKey] = compoundKey.split("__");
    const bucketState = existingBalances?.[`${productId}__${whKey}`]?.buckets?.[bucketKey] || {
      qty: 0,
      avgCost: 0,
    };

    const newQty = Number(bucketState.qty || 0) - Number(outQty || 0);
    const ref = doc(db, "stock_balances", productId);
    transaction.set(
      ref,
      {
        warehouses: {
          [whKey]: {
            [bucketKey]: {
              qty: newQty,
              avgCost: Number(bucketState.avgCost) || 0,
              updatedAt: serverTimestamp(),
            },
          },
        },
      },
      { merge: true }
    );
  }
}

export function writeStockBalancesAfterReturn({
  transaction,
  items,
  existingBalances,
}) {
  const inByKey = {};

  for (const item of items || []) {
    const parts = Array.isArray(item.stockConsumption)
      ? item.stockConsumption
      : Array.isArray(item.costBreakdown)
      ? item.costBreakdown
      : [];

    for (const part of parts) {
      if (!item?.productId) continue;
      const whKey = safeWarehouseKey(item.warehouseKey);
      const q = Number(part.qty || 0);
      if (!q) continue;
      const bucket = part.bucket === "official" ? "official" : "actual";
      const k = `${item.productId}__${whKey}__${bucket}`;
      inByKey[k] = (inByKey[k] || 0) + q;
    }
  }

  for (const [compoundKey, inQty] of Object.entries(inByKey)) {
    const [productId, whKey, bucketKey] = compoundKey.split("__");
    const bucketState = existingBalances?.[`${productId}__${whKey}`]?.buckets?.[bucketKey] || {
      qty: 0,
      avgCost: 0,
    };

    const newQty = Number(bucketState.qty || 0) + Number(inQty || 0);
    const ref = doc(db, "stock_balances", productId);
    transaction.set(
      ref,
      {
        warehouses: {
          [whKey]: {
            [bucketKey]: {
              qty: newQty,
              avgCost: Number(bucketState.avgCost) || 0,
              updatedAt: serverTimestamp(),
            },
          },
        },
      },
      { merge: true }
    );
  }
}
