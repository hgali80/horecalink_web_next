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

function hintPrice(match, docType, vatMode) {
  const price = num(match.item.unitPrice);
  if (match.row.docType !== "R" || docType !== "R" ||
      !["included", "excluded"].includes(match.row.vatMode) ||
      !["included", "excluded"].includes(vatMode) || match.row.vatMode === vatMode) return price;
  return vatMode === "included" ? price * 1.16 : price / 1.16;
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

export function resolveErpSalesPriceHints({ rows, productId, cariId, docType, vatMode }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const matchProduct = (item) => text(item.productId) === text(productId);
  const sameCari = (row) => text(row.cariId || row?.cariSnapshot?.id) === text(cariId);
  const sameDocType = (row) => text(row.docType).toUpperCase() === text(docType).toUpperCase();

  const general = findLatestItem(safeRows, (_, item) => matchProduct(item));
  const byCari = cariId ? findLatestItem(safeRows, (row, item) => matchProduct(item) && sameCari(row)) : null;
  const byDocType = findLatestItem(safeRows, (row, item) => matchProduct(item) && sameDocType(row));

  return {
    lastSale: general
      ? buildPriceHint("Son satis", hintPrice(general, docType, vatMode), {
          documentNo: text(general.row.documentNo),
          cariName: text(general.row.cariName),
        })
      : null,
    lastSaleByCari: byCari
      ? buildPriceHint("Bu cariye son satis", hintPrice(byCari, docType, vatMode), {
          documentNo: text(byCari.row.documentNo),
          sourceDocType: byCari.row.docType,
          sourceVatMode: byCari.row.vatMode || "unknown",
        })
      : null,
    lastSaleByDocType: byDocType
      ? buildPriceHint("Bu evrak turunde son satis", hintPrice(byDocType, docType, vatMode), {
          documentNo: text(byDocType.row.documentNo),
        })
      : null,
  };
}

// Only newly selected, automatically priced rows follow a changed customer/tax mode.
// Reopened documents and manually edited prices are never overwritten here.
export function refreshAutomaticSalesPrices(items, rows, { cariId, docType, vatMode }) {
  return items.map((item) => {
    if (!item.automaticSalesPrice || !item.productId) return item;
    const hints = resolveErpSalesPriceHints({ rows, productId: item.productId, cariId, docType, vatMode });
    return { ...item, unitPrice: round2(hints.lastSaleByCari?.value ?? hints.lastSale?.value ?? item.defaultSalesPrice ?? 0) };
  });
}

export function resolveErpPurchasePriceHints({ rows, productId, cariId, docType, vatMode }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const matchProduct = (item) => text(item.productId) === text(productId);
  const sameCari = (row) => text(row.cariId || row?.cariSnapshot?.id) === text(cariId);
  const sameDocType = (row) => text(row.docType).toUpperCase() === text(docType).toUpperCase();

  const general = findLatestItem(safeRows, (_, item) => matchProduct(item));
  const byCari = cariId ? findLatestItem(safeRows, (row, item) => matchProduct(item) && sameCari(row)) : null;
  const byDocType = findLatestItem(safeRows, (row, item) => matchProduct(item) && sameDocType(row));

  return {
    lastPurchase: general
      ? buildPriceHint("Son alis", hintPrice(general, docType, vatMode), {
          documentNo: text(general.row.documentNo),
          cariName: text(general.row.cariName),
        })
      : null,
    lastPurchaseByCari: byCari
      ? buildPriceHint("Bu cariden son alis", hintPrice(byCari, docType, vatMode), {
          documentNo: text(byCari.row.documentNo),
        })
      : null,
    lastPurchaseByDocType: byDocType
      ? buildPriceHint("Bu evrak turunde son alis", hintPrice(byDocType, docType, vatMode), {
          documentNo: text(byDocType.row.documentNo),
        })
      : null,
  };
}
