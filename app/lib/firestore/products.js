// app/lib/firestore/products.js
import {
  collection,
  documentId,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../firebase";

function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (text.toLowerCase() === "null") return "";
  return text;
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }

  const text = cleanText(value);
  if (!text) return [];

  return text
    .split(/[\n,;]+/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function normalizeTimestamp(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? cleanText(value) : new Date(parsed).toISOString();
  }

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    const seconds = Number(value.seconds);
    const nanoseconds = Number(value.nanoseconds || 0);

    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000 + nanoseconds / 1e6).toISOString();
    }
  }

  return cleanText(value) || null;
}

function normalizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((acc, [key, item]) => {
    acc[key] = normalizeUnknown(item);
    return acc;
  }, {});
}

function normalizeUnknown(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUnknown(item));
  }

  if (value && typeof value?.toDate === "function") {
    return normalizeTimestamp(value);
  }

  if (value && typeof value === "object") {
    if (
      Object.prototype.hasOwnProperty.call(value, "seconds") &&
      Object.prototype.hasOwnProperty.call(value, "nanoseconds")
    ) {
      return normalizeTimestamp(value);
    }

    return normalizeObject(value);
  }

  return value;
}

function normalizeProduct(doc) {
  const data = doc.data();
  const imageNames = normalizeArray(data.image_names);
  const fallbackImageBase = cleanText(data.imageBase);
  const normalizedImageNames =
    imageNames.length || !fallbackImageBase
      ? imageNames
      : normalizeArray(fallbackImageBase)
          .map((item) => (/\.[a-z0-9]+$/i.test(item) ? item : `${item}.jpg`));

  return {
    id: doc.id,
    ...normalizeObject(data),
    active: asBoolean(data.active, true),
    webPublished: asBoolean(data.webPublished, true),
    saleEnabled: asBoolean(data.saleEnabled, true),
    purchaseEnabled: asBoolean(data.purchaseEnabled, true),
    stockTracked: asBoolean(data.stockTracked, true),
    isNew: asBoolean(data.isNew, false),
    popular:
      typeof data.popular === "number" && Number.isFinite(data.popular)
        ? Number(data.popular)
        : asBoolean(data.popular, false),
    brand: cleanText(data.brand),
    badge: cleanText(data.badge),
    barcode: cleanText(data.barcode),
    unit: cleanText(data.unit),
    slug: cleanText(data.slug),
    name: cleanText(data.name),
    name_tr: cleanText(data.name_tr),
    manufacturerCode: cleanText(data.manufacturerCode),
    sku: cleanText(data.sku),
    stock_code: cleanText(data.stock_code || doc.id),
    group: cleanText(data.group),
    groupKey: cleanText(data.groupKey),
    category: cleanText(data.category),
    categoryKey: cleanText(data.categoryKey),
    subcategory: cleanText(data.subcategory),
    subcategoryKey: cleanText(data.subcategoryKey),
    main_category: cleanText(data.main_category),
    sub_category: cleanText(data.sub_category),
    shortDescription: cleanText(data.shortDescription),
    description: cleanText(data.description),
    specs: cleanText(data.specs),
    highlightLines: cleanText(data.highlightLines),
    material: cleanText(data.material),
    dimensions: cleanText(data.dimensions),
    capacity: cleanText(data.capacity),
    power: cleanText(data.power),
    voltage: cleanText(data.voltage),
    fuelType: cleanText(data.fuelType),
    weight: cleanText(data.weight),
    warranty: cleanText(data.warranty),
    technicalPdf: cleanText(data.technicalPdf),
    catalogPdf: cleanText(data.catalogPdf),
    videoUrl: cleanText(data.videoUrl),
    imageBase: cleanText(data.imageBase),
    image_names: normalizedImageNames,
    binding_codes: normalizeArray(data.binding_codes),
    tags: normalizeArray(data.tags),
    searchText: cleanText(data.searchText),
    meta: normalizeObject(data.meta),
    sortOrder: Number.isFinite(Number(data.sortOrder))
      ? Number(data.sortOrder)
      : 999999,
    order: Number.isFinite(Number(data.order))
      ? Number(data.order)
      : Number.isFinite(Number(data.sortOrder))
        ? Number(data.sortOrder)
        : 999999,
    price: Number.isFinite(Number(data.price)) ? Number(data.price) : null,
    vatRate: Number.isFinite(Number(data.vatRate)) ? Number(data.vatRate) : null,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
    importedAt: normalizeTimestamp(data.importedAt),
  };
}

function sortProducts(a, b) {
  const orderDiff = (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999);
  if (orderDiff !== 0) return orderDiff;

  return String(a.name || a.name_tr || "").localeCompare(
    String(b.name || b.name_tr || ""),
    "ru"
  );
}

export async function getCatalogProducts({
  groupKey,
  categoryKey = null,
  subcategoryKey = null,
}) {
  const constraints = [
    where("groupKey", "==", groupKey),
    where("active", "==", true),
    where("webPublished", "==", true),
  ];

  if (categoryKey) {
    constraints.push(where("categoryKey", "==", categoryKey));
  }

  if (subcategoryKey) {
    constraints.push(where("subcategoryKey", "==", subcategoryKey));
  }

  const q = query(collection(db, "products"), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(normalizeProduct).sort(sortProducts);
}

export async function getProductBySlug(slug) {
  const normalizedSlug = cleanText(slug);
  if (!normalizedSlug) return null;

  const q = query(
    collection(db, "products"),
    where("slug", "==", normalizedSlug),
    where("active", "==", true),
    where("webPublished", "==", true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return normalizeProduct(snapshot.docs[0]);
  }

  const fallbackById = query(
    collection(db, "products"),
    where(documentId(), "==", normalizedSlug),
    where("active", "==", true),
    where("webPublished", "==", true),
    limit(1)
  );

  const fallbackSnapshot = await getDocs(fallbackById);
  if (fallbackSnapshot.empty) return null;

  return normalizeProduct(fallbackSnapshot.docs[0]);
}

export async function getRelatedProducts(product, maxItems = 8) {
  if (!product) return [];

  const bindingCodes = normalizeArray(product.binding_codes);
  if (!bindingCodes.length) return [];

  const q = query(
    collection(db, "products"),
    where("active", "==", true),
    where("webPublished", "==", true)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(normalizeProduct)
    .filter((item) => item.id !== product.id)
    .filter((item) => {
      const itemBindings = normalizeArray(item.binding_codes);
      return itemBindings.some((code) => bindingCodes.includes(code));
    })
    .sort(sortProducts)
    .slice(0, maxItems);
}
