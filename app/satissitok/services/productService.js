// app/satissitok/services/productService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "@/firebase";

function toStr(x) {
  return (x ?? "").toString().trim();
}

function num(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function bool(x, fallback = false) {
  if (typeof x === "boolean") return x;
  const s = toStr(x).toLowerCase();
  if (["true", "1", "yes", "evet"].includes(s)) return true;
  if (["false", "0", "no", "hayir", "hayır"].includes(s)) return false;
  return fallback;
}

function csvToArr(x, { suffix = "" } = {}) {
  const s = toStr(x);
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      if (!suffix) return t;
      return t.toLowerCase().endsWith(suffix.toLowerCase()) ? t : `${t}${suffix}`;
    });
}

/**
 * ✅ Dosya isimlendirme kuralı:
 * - ilk foto: <code>.jpg
 * - sonraki: <code>-1.jpg, <code>-2.jpg, ...
 */
export function buildNextImageNames(stockCode, countToAdd, existingNames = []) {
  const code = toStr(stockCode);
  if (!code) throw new Error("stock_code boş olamaz.");

  const existing = new Set((existingNames || []).map((x) => toStr(x)).filter(Boolean));

  const names = [];
  let idx = 0;

  while (names.length < countToAdd) {
    const name = idx === 0 ? `${code}.jpg` : `${code}-${idx}.jpg`;
    if (!existing.has(name) && !names.includes(name)) {
      names.push(name);
    }
    idx += 1;
    if (idx > 9999) throw new Error("Çok fazla foto adı üretmeye çalışıyorsun.");
  }

  return names;
}

/**
 * Storage path:
 * product_images/<filename>
 */
export async function uploadProductImages({
  stockCode,
  files,
  existingImageNames = [],
  onProgress, // opsiyonel
}) {
  const code = toStr(stockCode);
  if (!code) throw new Error("Önce stock_code girmen lazım.");
  const list = Array.from(files || []);
  if (list.length === 0) return { imageNames: existingImageNames, uploaded: [] };

  const newNames = buildNextImageNames(code, list.length, existingImageNames);

  const uploaded = [];

  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    const filename = newNames[i]; // örn: 111222-2.jpg
    const path = `product_images/${filename}`;

    if (onProgress) onProgress({ index: i, total: list.length, filename, stage: "uploading" });

    const r = storageRef(storage, path);
    await uploadBytes(r, file, {
      contentType: file.type || "image/jpeg",
    });

    // URL’i zorunlu tutmuyoruz; gerekirse UI’da preview için kullanılır
    let url = "";
    try {
      url = await getDownloadURL(r);
    } catch (_) {}

    uploaded.push({ filename, path, url });

    if (onProgress) onProgress({ index: i, total: list.length, filename, stage: "done" });
  }

  const merged = [...(existingImageNames || []).map(toStr).filter(Boolean), ...newNames];

  return { imageNames: merged, uploaded };
}

/**
 * UI formundan gelen raw objeyi Firestore ürün şemasına normalize eder.
 */
export function normalizeProductInput(raw) {
  const stock_code = toStr(raw.stock_code);
  if (!stock_code) throw new Error("stock_code zorunlu.");

  const product = {
    main_category: toStr(raw.main_category),
    sub_category: toStr(raw.sub_category),
    barcode: toStr(raw.barcode),
    stock_code: stock_code, // string güvenli
    name: toStr(raw.name),
    name_tr: toStr(raw.name_tr),
    unit: toStr(raw.unit),
    brand: toStr(raw.brand),
    description: toStr(raw.description),
    specs: toStr(raw.specs),

    price: num(raw.price, 0),
    order: num(raw.order, 0),

    image_names: Array.isArray(raw.image_names)
      ? raw.image_names.map(toStr).filter(Boolean)
      : csvToArr(raw.image_names, { suffix: ".jpg" }),

    binding_codes: Array.isArray(raw.binding_codes)
      ? raw.binding_codes.map(toStr).filter(Boolean)
      : csvToArr(raw.binding_codes),

    active: bool(raw.active, true),
    webPublished: bool(raw.webPublished, false),
    productType: toStr(raw.productType) || "sale_item",
    stockTracked: bool(raw.stockTracked, true),
    saleEnabled: bool(raw.saleEnabled, true),
    purchaseEnabled: bool(raw.purchaseEnabled, true),
    vatRate: num(raw.vatRate, 16),
  };

  return product;
}

export async function getProduct(productId) {
  const id = toStr(productId);
  const ref = doc(db, "products", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createProduct(raw) {
  const p = normalizeProductInput(raw);
  const ref = doc(db, "products", p.stock_code);

  const exists = await getDoc(ref);
  if (exists.exists()) {
    throw new Error(`Bu stock_code zaten var: ${p.stock_code}`);
  }

  await setDoc(ref, {
    ...p,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return p.stock_code;
}

export async function updateProduct(productId, raw) {
  const id = toStr(productId);
  if (!id) throw new Error("productId zorunlu.");

  const p = normalizeProductInput({ ...raw, stock_code: id });
  const ref = doc(db, "products", id);

  await updateDoc(ref, {
    ...p,
    updatedAt: serverTimestamp(),
  });

  return id;
}

export async function listProductsAdmin() {
  const q = query(collection(db, "products"), orderBy("stock_code", "asc"), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}