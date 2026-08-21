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
    brand: text(product.brand),
    description,
    unit: text(product.unit || product.unitType || "Adet"),
    unitPrice: number(product.price),
  };
}

export function buildDefaultPresentation() {
  return {
    title: `Ürün fiyat sunumu - ${new Date().toLocaleDateString("tr-TR")}`,
    status: "draft",
    currency: "KZT",
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
