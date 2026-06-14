"use client";

import { listProductsAdmin } from "@/app/satissitok/services/productService";

function text(value) {
  return String(value ?? "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function listErpProductOptions() {
  const rows = await listProductsAdmin();

  return rows
    .filter((item) => item.active !== false)
    .map((item) => ({
      id: item.id,
      sku: text(item.stock_code || item.sku || item.id),
      name: text(item.name || item.name_tr),
      brand: text(item.brand),
      unit: text(item.unit || item.unitType || "adet"),
      price: num(item.price, 0),
      vatRate: num(item.vatRate, 16),
      webPublished: item.webPublished === true,
      stockTracked: item.stockTracked !== false,
      saleEnabled: item.saleEnabled !== false,
      purchaseEnabled: item.purchaseEnabled !== false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
