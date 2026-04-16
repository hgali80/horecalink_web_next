import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import { buildProductSnapshot } from "./inventoryCatalogService";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function text(value) {
  return String(value || "").trim();
}

function toDateValue(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildLatestCostIndex(entries = []) {
  const index = {};

  for (const entry of entries || []) {
    const productId = text(entry?.productId);
    if (!productId) continue;

    const qty = num(entry?.qty);
    if (!(qty > 0)) continue;

    const supplierCariId = text(entry?.supplierCariId);
    const supplierName = text(entry?.supplierName).toLowerCase();
    const dateValue =
      entry?.documentDate?.toDate?.() ||
      entry?.documentDate ||
      entry?.createdAt?.toDate?.() ||
      entry?.createdAt ||
      null;
    const timestamp = toDateValue(dateValue)?.getTime() || 0;

    const candidates = [
      `${productId}__supplier:${supplierCariId}`,
      `${productId}__name:${supplierName}`,
      `${productId}__default`,
    ];

    for (const key of candidates) {
      if (!key.endsWith("supplier:") && !key.endsWith("name:")) {
        const prev = index[key];
        if (!prev || timestamp > prev.timestamp) {
          index[key] = { ...entry, timestamp };
        }
        continue;
      }

      const isSupplierKey = key.includes("__supplier:");
      if (isSupplierKey && !supplierCariId) continue;
      if (!isSupplierKey && !supplierName) continue;

      const prev = index[key];
      if (!prev || timestamp > prev.timestamp) {
        index[key] = { ...entry, timestamp };
      }
    }
  }

  return index;
}

export function findLatestCostEntry({
  latestCostIndex,
  productId,
  supplierId,
  supplierName,
}) {
  const id = text(productId);
  const supplierCariId = text(supplierId);
  const supplierKey = supplierCariId ? `${id}__supplier:${supplierCariId}` : "";
  const nameKey = text(supplierName)
    ? `${id}__name:${text(supplierName).toLowerCase()}`
    : "";

  return (
    (supplierKey ? latestCostIndex?.[supplierKey] : null) ||
    (nameKey ? latestCostIndex?.[nameKey] : null) ||
    latestCostIndex?.[`${id}__default`] ||
    null
  );
}

export async function listProductCostEntries() {
  const q = query(collection(db, "product_cost_entries"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listProductCostEntriesByProduct(productId) {
  const q = query(
    collection(db, "product_cost_entries"),
    where("productId", "==", productId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function writePurchaseCostEntries({
  transaction,
  purchaseId,
  purchaseType,
  supplierCariId,
  supplierName,
  invoiceNo,
  documentDate,
  warehouseKey,
  items,
  entryType = "purchase",
}) {
  const costCollection = collection(db, "product_cost_entries");

  for (const row of items || []) {
    const productId = text(row?.productId);
    const qty = round2(num(row?.qty ?? row?.quantity));
    if (!productId || !(qty > 0)) continue;

    const grossUnitCost = round2(num(row?.unitPrice));
    const netUnitCost = round2(num(row?.netUnitPrice ?? row?.netUnitCost ?? grossUnitCost));
    const vatUnitCost = round2(num(row?.vatUnitPrice ?? grossUnitCost - netUnitCost));
    const grossLineCost = round2(num(row?.grossLineTotal ?? row?.grossTotal ?? qty * grossUnitCost));
    const netLineCost = round2(num(row?.netLineTotal ?? row?.netTotal ?? qty * netUnitCost));
    const vatLineCost = round2(num(row?.vatLineTotal ?? row?.vatTotal ?? grossLineCost - netLineCost));

    const ref = doc(costCollection);
    transaction.set(ref, {
      productId,
      purchaseId,
      purchaseType,
      supplierCariId: supplierCariId || null,
      supplierName: supplierName || "",
      invoiceNo: invoiceNo || "",
      warehouseKey: warehouseKey || "main",
      entryType,
      qty,
      grossUnitCost,
      netUnitCost,
      vatUnitCost,
      grossLineCost,
      netLineCost,
      vatLineCost,
      priceSource: text(row?.priceSource || "auto") || "auto",
      documentDate: toDateValue(documentDate),
      productSnapshot: buildProductSnapshot(row?.productSnapshot || row),
      createdAt: serverTimestamp(),
    });
  }
}
