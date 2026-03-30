// app/lib/firestore/products.js
import {
  collection,
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
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function normalizeProduct(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    ...data,
    active: asBoolean(data.active, true),
    webPublished: asBoolean(data.webPublished, true),
    saleEnabled: asBoolean(data.saleEnabled, true),
    purchaseEnabled: asBoolean(data.purchaseEnabled, true),
    stockTracked: asBoolean(data.stockTracked, true),
    isNew: asBoolean(data.isNew, false),
    popular: asBoolean(data.popular, false),
    brand: cleanText(data.brand),
    badge: cleanText(data.badge),
    unit: cleanText(data.unit),
    slug: cleanText(data.slug),
    name: cleanText(data.name),
    name_tr: cleanText(data.name_tr),
    manufacturerCode: cleanText(data.manufacturerCode),
    sku: cleanText(data.sku),
    shortDescription: cleanText(data.shortDescription),
    description: cleanText(data.description),
    material: cleanText(data.material),
    dimensions: cleanText(data.dimensions),
    capacity: cleanText(data.capacity),
    power: cleanText(data.power),
    voltage: cleanText(data.voltage),
    fuelType: cleanText(data.fuelType),
    warranty: cleanText(data.warranty),
    technicalPdf: cleanText(data.technicalPdf),
    catalogPdf: cleanText(data.catalogPdf),
    videoUrl: cleanText(data.videoUrl),
    image_names: normalizeArray(data.image_names),
    binding_codes: normalizeArray(data.binding_codes),
    tags: normalizeArray(data.tags),
    sortOrder: Number.isFinite(Number(data.sortOrder))
      ? Number(data.sortOrder)
      : 999999,
    price: Number.isFinite(Number(data.price)) ? Number(data.price) : null,
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

  if (snapshot.empty) return null;

  return normalizeProduct(snapshot.docs[0]);
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