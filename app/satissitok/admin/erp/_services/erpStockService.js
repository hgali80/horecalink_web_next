"use client";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { getProduct } from "@/app/satissitok/services/productService";
import { ERP_COLLECTIONS } from "./erpCollections";
import { listErpProductOptions } from "./erpProductsService";

function text(value) {
  return String(value ?? "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(num(value, 0) * 100) / 100;
}

function formatDate(value) {
  if (!value) return "-";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value?.seconds
          ? new Date(value.seconds * 1000)
          : new Date(value);

    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("tr-TR");
  } catch {
    return "-";
  }
}

function resolveSortTime(value) {
  if (!value) return 0;
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);
  const time = date?.getTime?.() ?? 0;
  return Number.isFinite(time) ? time : 0;
}

function balanceRank(totalQty) {
  if (totalQty > 0) return 0;
  if (totalQty < 0) return 1;
  return 2;
}

function normalizeMovement(item) {
  const data = item.data() || {};
  return {
    id: item.id,
    productId: text(data.productId),
    productName: text(data.productName),
    productSku: text(data.productSku),
    movementType: text(data.movementType),
    bucket: text(data.bucket),
    quantity: num(data.quantity, 0),
    documentId: text(data.documentId),
    documentCollection: text(data.documentCollection),
    docType: text(data.docType).toUpperCase() === "F" ? "F" : "R",
    documentNo: text(data.documentNo),
    cariName: text(data.cariName),
    effectiveUnitCost: round2(data.effectiveUnitCost),
    effectiveLineCost: round2(data.effectiveLineCost),
    additionalCostShare: round2(data.additionalCostShare),
    usedCostFallback: data.usedCostFallback === true,
    costBucketUsed: text(data.costBucketUsed),
    dateLabel: formatDate(data.movementDate || data.createdAt),
    sortTime: resolveSortTime(data.movementDate || data.createdAt),
  };
}

export async function listErpStockBalances() {
  const [products, balanceSnap] = await Promise.all([
    listErpProductOptions(),
    getDocs(collection(db, ERP_COLLECTIONS.STOCK_BALANCES)),
  ]);

  const balanceMap = new Map(
    balanceSnap.docs.map((item) => [item.id, item.data() || {}])
  );

  const rows = products.map((product) => {
    const balance = balanceMap.get(product.id) || {};
    const rQty = num(balance.rQty, 0);
    const fQty = num(balance.fQty, 0);
    const totalQty = round2(rQty + fQty);
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      unit: product.unit,
      webPublished: product.webPublished === true,
      stockTracked: product.stockTracked !== false,
      rQty,
      fQty,
      totalQty,
      rAvgCost: round2(balance.rAvgCost),
      fAvgCost: round2(balance.fAvgCost),
      updatedLabel: formatDate(balance.updatedAt),
    };
  });

  rows.sort((a, b) => {
    const rankDiff = balanceRank(a.totalQty) - balanceRank(b.totalQty);
    if (rankDiff !== 0) return rankDiff;
    if (a.totalQty !== b.totalQty) return b.totalQty - a.totalQty;
    return a.name.localeCompare(b.name, "tr");
  });

  return rows;
}

export async function getErpProductStockBalance(productId) {
  const ref = doc(db, ERP_COLLECTIONS.STOCK_BALANCES, productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { rQty: 0, fQty: 0, totalQty: 0, rAvgCost: 0, fAvgCost: 0 };
  }

  const data = snap.data() || {};
  const rQty = num(data.rQty, 0);
  const fQty = num(data.fQty, 0);
  return {
    rQty,
    fQty,
    totalQty: round2(rQty + fQty),
    rAvgCost: round2(data.rAvgCost),
    fAvgCost: round2(data.fAvgCost),
  };
}

export async function listErpStockMovements() {
  const snap = await getDocs(collection(db, ERP_COLLECTIONS.STOCK_MOVEMENTS));
  const rows = snap.docs.map(normalizeMovement);
  rows.sort((a, b) => b.sortTime - a.sortTime);
  return rows;
}

export async function getErpStockCard(productId) {
  const [product, balance, movements] = await Promise.all([
    getProduct(productId),
    getErpProductStockBalance(productId),
    listErpStockMovements(),
  ]);

  if (!product) {
    throw new Error("Urun bulunamadi.");
  }

  const related = movements.filter((item) => item.productId === productId);
  const purchases = related.filter((item) => item.movementType === "purchase");
  const sales = related.filter((item) => item.movementType === "sale");
  const fallbacks = related.filter((item) => item.usedCostFallback);

  return {
    product: {
      id: product.id,
      sku: text(product.stock_code || product.sku || product.id),
      name: text(product.name || product.name_tr),
      brand: text(product.brand),
      unit: text(product.unit || product.unitType || "adet"),
      webPublished: product.webPublished === true,
      stockTracked: product.stockTracked !== false,
    },
    balance,
    movements: related,
    purchases,
    sales,
    fallbacks,
    summary: {
      purchaseCount: purchases.length,
      saleCount: sales.length,
      fallbackCount: fallbacks.length,
      lastPurchaseCost: purchases[0]?.effectiveUnitCost || 0,
      lastSaleCost: sales[0]?.effectiveUnitCost || 0,
    },
  };
}
