"use client";

import { ERP_COLLECTIONS } from "./erpCollections";
import { listErpDocuments } from "./erpDocumentsService";

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

function normalizeRows(rows, kind) {
  return (Array.isArray(rows) ? rows : [])
    .filter((item) => item.status === "confirmed")
    .map((item) => ({
      ...item,
      kind,
      items: Array.isArray(item.items) ? item.items : [],
    }));
}

function buildPriceHint(label, value, meta = {}) {
  return {
    label,
    value: round2(value),
    ...meta,
  };
}

function findLatestItem(rows, matcher) {
  for (const row of rows) {
    const items = Array.isArray(row.items) ? row.items : [];
    for (const item of items) {
      if (matcher(row, item)) {
        return { row, item };
      }
    }
  }
  return null;
}

export async function getErpPriceMemoryDataset() {
  const [sales, purchases] = await Promise.all([
    listErpDocuments(ERP_COLLECTIONS.SALES),
    listErpDocuments(ERP_COLLECTIONS.PURCHASES),
  ]);

  return {
    sales: normalizeRows(sales, "sales"),
    purchases: normalizeRows(purchases, "purchases"),
  };
}

export function resolveErpSalesPriceHints({ rows, productId, cariId, docType }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const matchProduct = (item) => text(item.productId) === text(productId);
  const sameCari = (row) => text(row.cariId || row?.cariSnapshot?.id) === text(cariId);
  const sameDocType = (row) => text(row.docType).toUpperCase() === text(docType).toUpperCase();

  const general = findLatestItem(safeRows, (_, item) => matchProduct(item));
  const byCari = cariId ? findLatestItem(safeRows, (row, item) => matchProduct(item) && sameCari(row)) : null;
  const byDocType = findLatestItem(safeRows, (row, item) => matchProduct(item) && sameDocType(row));

  return {
    lastSale: general
      ? buildPriceHint("Son satis", general.item.unitPrice, {
          documentNo: text(general.row.documentNo),
          cariName: text(general.row.cariName),
        })
      : null,
    lastSaleByCari: byCari
      ? buildPriceHint("Bu cariye son satis", byCari.item.unitPrice, {
          documentNo: text(byCari.row.documentNo),
        })
      : null,
    lastSaleByDocType: byDocType
      ? buildPriceHint("Bu evrak turunde son satis", byDocType.item.unitPrice, {
          documentNo: text(byDocType.row.documentNo),
        })
      : null,
  };
}

export function resolveErpPurchasePriceHints({ rows, productId, cariId, docType }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const matchProduct = (item) => text(item.productId) === text(productId);
  const sameCari = (row) => text(row.cariId || row?.cariSnapshot?.id) === text(cariId);
  const sameDocType = (row) => text(row.docType).toUpperCase() === text(docType).toUpperCase();

  const general = findLatestItem(safeRows, (_, item) => matchProduct(item));
  const byCari = cariId ? findLatestItem(safeRows, (row, item) => matchProduct(item) && sameCari(row)) : null;
  const byDocType = findLatestItem(safeRows, (row, item) => matchProduct(item) && sameDocType(row));

  return {
    lastPurchase: general
      ? buildPriceHint("Son alis", general.item.unitPrice, {
          documentNo: text(general.row.documentNo),
          cariName: text(general.row.cariName),
        })
      : null,
    lastPurchaseByCari: byCari
      ? buildPriceHint("Bu cariden son alis", byCari.item.unitPrice, {
          documentNo: text(byCari.row.documentNo),
        })
      : null,
    lastPurchaseByDocType: byDocType
      ? buildPriceHint("Bu evrak turunde son alis", byDocType.item.unitPrice, {
          documentNo: text(byDocType.row.documentNo),
        })
      : null,
  };
}
