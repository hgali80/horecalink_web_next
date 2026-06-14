"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { ERP_COLLECTIONS, ERP_SETTINGS_DOC_ID } from "./erpCollections";

function text(value) {
  return String(value ?? "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeChoiceRows(value, fallback = []) {
  const rows = normalizeList(value)
    .map((item, index) => ({
      key: text(item?.key),
      label: text(item?.label),
      active: item?.active !== false,
      default: item?.default === true,
      sortOrder: num(item?.sortOrder, index + 1),
    }))
    .filter((item) => item.key && item.label)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!rows.length) return fallback;
  if (!rows.some((item) => item.default)) rows[0].default = true;
  return rows;
}

function normalizeTaxRows(value, fallback = []) {
  const rows = normalizeList(value)
    .map((item, index) => ({
      key: text(item?.key),
      label: text(item?.label),
      rate: num(item?.rate, 0),
      active: item?.active !== false,
      default: item?.default === true,
      sortOrder: num(item?.sortOrder, index + 1),
    }))
    .filter((item) => item.key && item.label)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!rows.length) return fallback;
  if (!rows.some((item) => item.default)) rows[0].default = true;
  return rows;
}

export const DEFAULT_ERP_SETTINGS = {
  warehouses: [
    { key: "main", label: "Ana Depo", active: true, default: true, sortOrder: 1 },
  ],
  salesPlatforms: [
    { key: "store", label: "Magaza", active: true, default: true, sortOrder: 1 },
    { key: "web", label: "Web", active: true, default: false, sortOrder: 2 },
    { key: "kaspi", label: "Kaspi Magazin", active: true, default: false, sortOrder: 3 },
    { key: "olx", label: "OLX", active: true, default: false, sortOrder: 4 },
  ],
  paymentMethods: [
    { key: "cash", label: "Nakit", active: true, default: true, sortOrder: 1 },
    { key: "bank", label: "Banka", active: true, default: false, sortOrder: 2 },
    { key: "transfer", label: "Havale", active: true, default: false, sortOrder: 3 },
  ],
  numbering: {
    sales: {
      R: { draftPrefix: "SD-R", documentPrefix: "SB-R", invoicePrefix: "SF-R" },
      F: { draftPrefix: "SD-F", documentPrefix: "SB-F", invoicePrefix: "SF-F" },
    },
    purchases: {
      R: { draftPrefix: "PD-R", documentPrefix: "PB-R", invoicePrefix: "PF-R" },
      F: { draftPrefix: "PD-F", documentPrefix: "PB-F", invoicePrefix: "PF-F" },
    },
  },
  taxes: {
    vat: [{ key: "vat_16", label: "KDV %16", rate: 16, active: true, default: true, sortOrder: 1 }],
  },
};

export function normalizeErpSettings(raw = {}) {
  const warehouses = normalizeChoiceRows(raw?.warehouses, DEFAULT_ERP_SETTINGS.warehouses);
  const salesPlatforms = normalizeChoiceRows(
    raw?.salesPlatforms,
    DEFAULT_ERP_SETTINGS.salesPlatforms
  );
  const paymentMethods = normalizeChoiceRows(
    raw?.paymentMethods,
    DEFAULT_ERP_SETTINGS.paymentMethods
  );
  const vat = normalizeTaxRows(raw?.taxes?.vat, DEFAULT_ERP_SETTINGS.taxes.vat);
  const numbering = normalizeNumbering(raw?.numbering);

  return {
    warehouses,
    salesPlatforms,
    paymentMethods,
    numbering,
    taxes: { vat },
  };
}

export async function getErpSettings() {
  const ref = doc(db, ERP_COLLECTIONS.SETTINGS, ERP_SETTINGS_DOC_ID);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const seeded = normalizeErpSettings(DEFAULT_ERP_SETTINGS);
    await setDoc(
      ref,
      {
        ...seeded,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return seeded;
  }

  return normalizeErpSettings(snap.data() || {});
}

export async function saveErpSettings(payload) {
  const normalized = normalizeErpSettings(payload);
  const ref = doc(db, ERP_COLLECTIONS.SETTINGS, ERP_SETTINGS_DOC_ID);
  await setDoc(
    ref,
    {
      ...normalized,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return normalized;
}

function normalizeNumbering(raw = {}) {
  const fallback = DEFAULT_ERP_SETTINGS.numbering;
  return {
    sales: {
      R: {
        draftPrefix: text(raw?.sales?.R?.draftPrefix || fallback.sales.R.draftPrefix),
        documentPrefix: text(raw?.sales?.R?.documentPrefix || fallback.sales.R.documentPrefix),
        invoicePrefix: text(raw?.sales?.R?.invoicePrefix || fallback.sales.R.invoicePrefix),
      },
      F: {
        draftPrefix: text(raw?.sales?.F?.draftPrefix || fallback.sales.F.draftPrefix),
        documentPrefix: text(raw?.sales?.F?.documentPrefix || fallback.sales.F.documentPrefix),
        invoicePrefix: text(raw?.sales?.F?.invoicePrefix || fallback.sales.F.invoicePrefix),
      },
    },
    purchases: {
      R: {
        draftPrefix: text(raw?.purchases?.R?.draftPrefix || fallback.purchases.R.draftPrefix),
        documentPrefix: text(
          raw?.purchases?.R?.documentPrefix || fallback.purchases.R.documentPrefix
        ),
        invoicePrefix: text(raw?.purchases?.R?.invoicePrefix || fallback.purchases.R.invoicePrefix),
      },
      F: {
        draftPrefix: text(raw?.purchases?.F?.draftPrefix || fallback.purchases.F.draftPrefix),
        documentPrefix: text(
          raw?.purchases?.F?.documentPrefix || fallback.purchases.F.documentPrefix
        ),
        invoicePrefix: text(raw?.purchases?.F?.invoicePrefix || fallback.purchases.F.invoicePrefix),
      },
    },
  };
}
