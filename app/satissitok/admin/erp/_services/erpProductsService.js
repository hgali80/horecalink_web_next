"use client";

import { listProductsAdmin } from "@/app/satissitok/services/productService";

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";

function text(value) {
  return String(value ?? "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const next = String(value).trim();
  if (!next || next.toLowerCase() === "null") return "";
  return next;
}

function getProductImageUrl(item = {}) {
  const imageNames = Array.isArray(item.image_names) ? item.image_names.map(text).filter(Boolean) : [];
  const imageName = imageNames[0] || cleanText(item.imageBase || item.stock_code || item.sku || item.id);

  if (!imageName) return "";

  const fileName = /\.[a-z0-9]+$/i.test(imageName) ? imageName : `${imageName}.jpg`;
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(fileName)}?alt=media`;
}

export async function listErpProductOptions() {
  const rows = await listProductsAdmin();

  return rows
    .filter((item) => item.active !== false)
    .map((item) => ({
      id: item.id,
      sku: text(item.stock_code || item.sku || item.id),
      name: text(item.name || item.name_tr),
      nameTr: text(item.name_tr || item.name),
      nameRu: text(item.name_ru),
      brand: text(item.brand),
      barcode: text(item.barcode),
      unit: text(item.unit || item.unitType || "adet"),
      price: num(item.price, 0),
      imageUrl: getProductImageUrl(item),
      imageName: text(Array.isArray(item.image_names) ? item.image_names[0] : ""),
      searchText: text(item.searchText),
      vatRate: num(item.vatRate, 16),
      webPublished: item.webPublished === true,
      stockTracked: item.stockTracked !== false,
      saleEnabled: item.saleEnabled !== false,
      purchaseEnabled: item.purchaseEnabled !== false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
