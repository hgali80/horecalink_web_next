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
import { db } from "@/firebase";

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
 * UI formundan gelen raw objeyi Firestore ürün şemasına normalize eder.
 * - array alanları: image_names, binding_codes
 * - number alanları: price, order, vatRate
 * - bool alanları: active, webPublished, stockTracked, saleEnabled, purchaseEnabled
 */
export function normalizeProductInput(raw) {
  const stock_code = toStr(raw.stock_code);
  if (!stock_code) throw new Error("stock_code zorunlu.");

  const product = {
    // mevcut alanlar (legacy uyum)
    main_category: toStr(raw.main_category),
    sub_category: toStr(raw.sub_category),
    barcode: toStr(raw.barcode),
    stock_code: stock_code, // string tutmak güvenli
    name: toStr(raw.name),
    name_tr: toStr(raw.name_tr),
    unit: toStr(raw.unit),
    brand: toStr(raw.brand),
    description: toStr(raw.description),
    specs: toStr(raw.specs),

    price: num(raw.price, 0),
    order: num(raw.order, 0),

    image_names: Array.isArray(raw.image_names)
      ? raw.image_names
      : csvToArr(raw.image_names, { suffix: ".jpg" }),

    binding_codes: Array.isArray(raw.binding_codes)
      ? raw.binding_codes
      : csvToArr(raw.binding_codes),

    // yeni alanlar
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

/**
 * Yeni ürün oluşturur (aynı stock_code varsa hata).
 * createdAt/updatedAt serverTimestamp ile yazılır.
 */
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

/**
 * Ürünü günceller (createdAt'a dokunmaz).
 */
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

/**
 * Admin listesi için basit listeleme (ilk 500).
 * (3-5k ürün için yeterli; sonra sayfalama ekleriz.)
 */
export async function listProductsAdmin() {
  const q = query(
    collection(db, "products"),
    orderBy("stock_code", "asc"),
    limit(500)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}