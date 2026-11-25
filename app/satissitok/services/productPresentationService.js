"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/firebase";

const COLLECTION_NAME = "product_presentations";
const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";

function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function imageNameOf(product = {}) {
  const candidate =
    (Array.isArray(product.image_names) ? product.image_names.find(Boolean) : "") ||
    product.imageBase ||
    product.stock_code ||
    product.sku ||
    product.id ||
    "";
  const fileName = text(candidate);
  if (!fileName) return "";
  return /\.[a-z0-9]+$/i.test(fileName) ? fileName : `${fileName}.jpg`;
}

export function getPresentationProductImageUrl(product = {}) {
  const imageName = imageNameOf(product);
  if (!imageName) return "";
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(imageName)}?alt=media`;
}

export function buildPresentationItemFromProduct(product = {}) {
  const imageName = imageNameOf(product);
  const description =
    text(product.specs) ||
    text(product.technicalDetails) ||
    text(product.highlightLines) ||
    [
      product.dimensions ? `Ölçüler: ${text(product.dimensions)}` : "",
      product.capacity ? `Kapasite: ${text(product.capacity)}` : "",
      product.power ? `Güç: ${text(product.power)}` : "",
      product.voltage ? `Voltaj: ${text(product.voltage)}` : "",
      product.material ? `Malzeme: ${text(product.material)}` : "",
    ].filter(Boolean).join("\n") ||
    text(product.description) ||
    text(product.shortDescription);

  return {
    rowId: `${text(product.id || product.stock_code || Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
    productId: text(product.id || product.stock_code),
    sku: text(product.sku || product.stock_code || product.id),
    imageName,
    imageUrl: getPresentationProductImageUrl(product),
    name: text(product.name || product.name_tr || product.name_ru || "Ürün"),
    nameTr: text(product.name_tr),
    nameRu: text(product.name_ru || product.name),
    nameKz: text(product.name_kz || product.name_kk),
    descriptionTr: text(product.specs_tr || product.description_tr || product.technicalDetails_tr),
    descriptionRu: text(product.specs_ru || product.description_ru || product.technicalDetails_ru),
    descriptionKz: text(product.specs_kz || product.specs_kk || product.description_kz || product.description_kk || product.technicalDetails_kz || product.technicalDetails_kk),
    brand: text(product.brand),
    description,
    unit: text(product.unit || product.unitType || "Adet"),
    unitPrice: number(product.price),
    pricePercent: 0,
    adjustedUnitPrice: null,
  };
}

export function getLocalizedPresentationItemName(item = {}, language = "tr") {
  const localized = language === "ru" ? item.nameRu : language === "kz" ? item.nameKz : item.nameTr;
  return text(localized) || text(item.name) || (language === "ru" ? "Товар" : language === "kz" ? "Өнім" : "Ürün");
}

export function getLocalizedPresentationItemDescription(item = {}, language = "tr") {
  const localized = language === "ru" ? item.descriptionRu : language === "kz" ? item.descriptionKz : item.descriptionTr;
  return text(localized) || text(item.description);
}

export function getAdjustedPresentationPrice(item = {}) {
  const manualPrice = Number(item.adjustedUnitPrice);
  if (item.adjustedUnitPrice !== null && item.adjustedUnitPrice !== undefined && Number.isFinite(manualPrice)) return manualPrice;
  const basePrice = number(item.unitPrice);
  const percent = number(item.pricePercent);
  return Math.round((basePrice * (1 + percent / 100) + Number.EPSILON) * 100) / 100;
}

export function getPresentationPriceColumns(presentation = {}) {
  return {
    base: presentation.priceColumns?.base !== false,
    adjusted: presentation.priceColumns?.adjusted === true,
  };
}

export function buildDefaultPresentation() {
  return {
    title: `Ürün fiyat sunumu - ${new Date().toLocaleDateString("tr-TR")}`,
    status: "draft",
    currency: "KZT",
    defaultPricePercent: "",
    priceColumns: { base: true, adjusted: false },
    visibility: { showWebsite: true },
    contact: {
      phone: "+7 700 444 69 11",
      website: "www.horecalink.kz",
    },
    items: [],
  };
}

export async function listProductPresentations() {
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc")));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getProductPresentation(presentationId) {
  const snap = await getDoc(doc(db, COLLECTION_NAME, presentationId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createProductPresentation(payload) {
  const ref = await addDoc(collection(db, COLLECTION_NAME), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveProductPresentation(presentationId, payload) {
  await setDoc(
    doc(db, COLLECTION_NAME, presentationId),
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
