import "server-only";

import * as xlsx from "xlsx";
import { DEFAULT_SHEET_NAME } from "./productImport";

const HEADER_ROW_INDEX = 3;
const DATA_START_ROW_INDEX = 5;

// Keep this list aligned with the importer's supported product fields.
const PRODUCT_HEADERS = [
  "id", "sku", "manufacturerCode", "slug", "name", "name_tr", "unit", "brand", "price",
  "group", "category", "subcategory", "groupKey", "categoryKey", "subcategoryKey",
  "shortDescription", "description", "specs", "highlightLines", "searchText", "seoTitle",
  "metaDescription", "imageBase", "image_names", "active", "webPublished", "badge", "isNew",
  "popular", "sortOrder", "binding_codes", "material", "packQty", "caseQty", "unitType",
  "dimensions", "capacity", "power", "voltage", "fuelType", "weight", "warranty", "technicalPdf",
  "catalogPdf", "videoUrl", "tags", "productType", "stockTracked", "saleEnabled", "purchaseEnabled",
  "vatRate", "createdAt", "updatedAt",
];

function serializeCell(value, header) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (["image_names", "binding_codes", "tags"].includes(header)) {
      return value.map((item) => String(item ?? "")).join("\n");
    }
    return JSON.stringify(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    return JSON.stringify(value);
  }
  return value;
}

export function createProductExportWorkbook(products, sheetName = DEFAULT_SHEET_NAME) {
  const extraHeaders = Array.from(
    new Set(products.flatMap((product) => Object.keys(product)))
  ).filter((key) => !PRODUCT_HEADERS.includes(key)).sort((a, b) => a.localeCompare(b, "tr"));
  const headers = [...PRODUCT_HEADERS, ...extraHeaders];
  const worksheet = {};

  xlsx.utils.sheet_add_aoa(worksheet, [headers], { origin: { r: HEADER_ROW_INDEX, c: 0 } });
  const rows = products.map((product) => {
    const row = { ...product, id: product.id, sortOrder: product.sortOrder ?? product.order };
    return headers.map((header) => serializeCell(row[header], header));
  });
  if (rows.length) {
    xlsx.utils.sheet_add_aoa(worksheet, rows, { origin: { r: DATA_START_ROW_INDEX, c: 0 } });
  }

  worksheet["!cols"] = headers.map((header) => ({ wch: Math.min(Math.max(header.length + 2, 14), 36) }));
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName || DEFAULT_SHEET_NAME);
  return workbook;
}

export async function exportProductsToExcel(adminDb) {
  const snapshot = await adminDb.collection("products").get();
  const products = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "tr"));
  const workbook = createProductExportWorkbook(products);
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
}
