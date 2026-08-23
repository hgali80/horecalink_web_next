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
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/firebase";

const COLLECTION_NAME = "informal_product_lists";
const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";

function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function safePathPart(value, fallback) {
  return text(value).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 120) || fallback;
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

export function getProductListImageUrl(product = {}) {
  const imageName = imageNameOf(product);
  if (!imageName) return "";
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(imageName)}?alt=media`;
}

export function buildProductListItem(product = {}) {
  const description =
    text(product.specs) ||
    text(product.technicalDetails) ||
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
    imageName: imageNameOf(product),
    imageUrl: getProductListImageUrl(product),
    name: text(product.name || product.name_ru || product.name_tr || "Ürün"),
    brand: text(product.brand),
    description,
    quantity: 1,
    unit: text(product.unit || product.unitType || "шт"),
    unitPrice: Math.max(0, number(product.price)),
  };
}

export function buildEmptyProductListItem(defaultUnit = "шт") {
  return {
    rowId: uniqueId("manual"),
    productId: "",
    sku: "",
    imageName: "",
    imageUrl: "",
    name: "",
    brand: "",
    description: "",
    quantity: 1,
    unit: text(defaultUnit) || "шт",
    unitPrice: 0,
    manual: true,
  };
}

export async function uploadProductListImage({ storageKey, rowId, file }) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Lütfen geçerli bir görsel dosyası seç.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Görsel dosyası en fazla 10 MB olabilir.");
  }
  const listPart = safePathPart(storageKey, uniqueId("list"));
  const rowPart = safePathPart(rowId, uniqueId("row"));
  const path = `informal_product_list_images/${listPart}/${rowPart}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type || "image/jpeg" });
  return { imageUrl: await getDownloadURL(ref), imageName: text(file.name), imagePath: path };
}

export function buildDefaultProductList() {
  return {
    title: `Spisok Tovar - ${new Date().toLocaleDateString("tr-TR")}`,
    status: "draft",
    customerName: "",
    issueDate: new Date().toISOString().slice(0, 10),
    currency: "KZT",
    storageKey: uniqueId("list"),
    note: "",
    contact: { phone: "+7 700 444 69 11", website: "www.horecalink.kz" },
    items: [],
  };
}

export function normalizeProductList(value = {}) {
  const defaults = buildDefaultProductList();
  return {
    ...defaults,
    ...value,
    customerName: text(value.customerName),
    issueDate: text(value.issueDate) || defaults.issueDate,
    note: text(value.note),
    storageKey: text(value.storageKey) || defaults.storageKey,
    contact: { ...defaults.contact, ...(value.contact || {}) },
    items: (Array.isArray(value.items) ? value.items : []).map((item, index) => ({
      ...item,
      rowId: text(item.rowId || item.productId || `row_${index + 1}`),
      quantity: Math.max(0, number(item.quantity, 1)),
      unitPrice: Math.max(0, number(item.unitPrice)),
    })),
  };
}

export function calculateProductListTotal(items = []) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, number(item.quantity)) * Math.max(0, number(item.unitPrice)),
    0
  );
}

export async function listProductLists() {
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc")));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getProductList(listId) {
  const snap = await getDoc(doc(db, COLLECTION_NAME, listId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createProductList(payload) {
  const ref = await addDoc(collection(db, COLLECTION_NAME), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveProductList(listId, payload) {
  await setDoc(doc(db, COLLECTION_NAME, listId), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}
