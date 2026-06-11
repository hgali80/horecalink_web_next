import "server-only";

import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";
import { FieldValue } from "firebase-admin/firestore";

export const DEFAULT_IMPORT_PATH = "D:\\web uygulaması araçları\\horecalink_urunleri_tam_liste.xlsx";
export const DEFAULT_SHEET_NAME = "Urun_Sablonu";

const HEADER_ROW_INDEX = 3;
const DATA_START_ROW_INDEX = 5;

const MANAGED_HEADERS = new Set([
  "id",
  "sku",
  "manufacturerCode",
  "slug",
  "name",
  "name_tr",
  "unit",
  "brand",
  "price",
  "group",
  "category",
  "subcategory",
  "groupKey",
  "categoryKey",
  "subcategoryKey",
  "shortDescription",
  "description",
  "specs",
  "highlightLines",
  "searchText",
  "seoTitle",
  "metaDescription",
  "imageBase",
  "image_names",
  "active",
  "webPublished",
  "badge",
  "isNew",
  "popular",
  "sortOrder",
  "binding_codes",
  "material",
  "packQty",
  "caseQty",
  "unitType",
  "dimensions",
  "capacity",
  "power",
  "voltage",
  "fuelType",
  "weight",
  "warranty",
  "technicalPdf",
  "catalogPdf",
  "videoUrl",
  "tags",
  "productType",
  "stockTracked",
  "saleEnabled",
  "purchaseEnabled",
  "vatRate",
  "createdAt",
  "updatedAt",
]);

class ImportValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ImportValidationError";
    this.details = details;
  }
}

function hasValue(value) {
  return !(
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function toText(value) {
  if (!hasValue(value)) return "";
  return String(value).trim();
}

function canReadFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeLineBreaks(value) {
  return toText(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function tryParseBoolean(value) {
  if (typeof value === "boolean") return value;

  const normalized = toText(value).toLowerCase();
  if (!normalized) return undefined;

  if (["true", "1", "yes", "evet", "aktif", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "hayir", "hayır", "pasif", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseBoolean(value, fallback) {
  const parsed = tryParseBoolean(value);
  return typeof parsed === "boolean" ? parsed : fallback;
}

function tryParseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = toText(value)
    .replace(/\s+/g, "")
    .replace(/,/g, ".");

  if (!normalized) return undefined;
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNumber(value, fallback = null) {
  const parsed = tryParseNumber(value);
  return typeof parsed === "number" ? parsed : fallback;
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }

  const normalized = normalizeLineBreaks(value);
  if (!normalized) return [];

  return normalized
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureImageExtension(value) {
  const clean = toText(value);
  if (!clean) return "";
  return /\.[a-z0-9]+$/i.test(clean) ? clean : `${clean}.jpg`;
}

function parseImageNames(value) {
  const list = splitList(value)
    .map((item) => ensureImageExtension(item))
    .filter(Boolean);

  return Array.from(new Set(list));
}

function parsePopular(value) {
  if (!hasValue(value)) return false;

  const boolValue = tryParseBoolean(value);
  if (typeof boolValue === "boolean") return boolValue;

  const numberValue = tryParseNumber(value);
  if (typeof numberValue === "number") return numberValue;

  return toText(value);
}

function inferExtraValue(value) {
  if (!hasValue(value)) return "";

  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;

  const normalized = normalizeLineBreaks(value);

  const boolValue = tryParseBoolean(normalized);
  if (typeof boolValue === "boolean") return boolValue;

  const numberValue = tryParseNumber(normalized);
  if (typeof numberValue === "number") return numberValue;

  if (
    (normalized.startsWith("{") && normalized.endsWith("}")) ||
    (normalized.startsWith("[") && normalized.endsWith("]"))
  ) {
    try {
      return JSON.parse(normalized);
    } catch {
      return normalized;
    }
  }

  return normalized;
}

function slugify(value, fallback) {
  const normalized = toText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function isRowEmpty(row) {
  return !row.some((cell) => hasValue(cell));
}

function buildRowObject(headers, row) {
  const rowObject = {};

  headers.forEach((header, index) => {
    const key = toText(header);
    if (!key) return;
    rowObject[key] = row[index];
  });

  return rowObject;
}

function normalizeForCompare(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCompare(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeForCompare(value[key]);
        return acc;
      }, {});
  }

  if (typeof value === "string") {
    return normalizeLineBreaks(value);
  }

  if (value === undefined) return null;
  return value;
}

function pickComparableSnapshot(existingData, payload) {
  const comparable = {};

  Object.keys(payload).forEach((key) => {
    comparable[key] = normalizeForCompare(existingData?.[key]);
  });

  return comparable;
}

function findFileByName(startDir, targetName, maxDepth = 3, depth = 0) {
  if (!startDir || depth > maxDepth) return "";

  let entries = [];
  try {
    entries = fs.readdirSync(startDir, { withFileTypes: true });
  } catch {
    return "";
  }

  for (const entry of entries) {
    const fullPath = path.join(startDir, entry.name);

    if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
      return fullPath;
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const nestedPath = findFileByName(
      path.join(startDir, entry.name),
      targetName,
      maxDepth,
      depth + 1
    );

    if (nestedPath) return nestedPath;
  }

  return "";
}

function resolveExcelPath(inputPath) {
  const cleanPath = toText(inputPath);
  if (!cleanPath) return DEFAULT_IMPORT_PATH;
  if (canReadFile(cleanPath)) return cleanPath;

  const parsed = path.parse(cleanPath);
  const rootDir = parsed.root || path.dirname(cleanPath);
  const targetName = parsed.base;

  if (targetName) {
    const matchedPath = findFileByName(rootDir, targetName);
    if (matchedPath && canReadFile(matchedPath)) {
      return matchedPath;
    }
  }

  throw new Error(`Cannot access file ${cleanPath}`);
}

function buildProductPayload(rowObject, rowNumber) {
  const id = toText(rowObject.id || rowObject.sku || rowObject.manufacturerCode);

  if (!id) {
    throw new Error(`Satir ${rowNumber}: id alani zorunlu.`);
  }

  const sku = toText(rowObject.sku) || id;
  const category = toText(rowObject.category);
  const subcategory = toText(rowObject.subcategory);
  const imageSource = hasValue(rowObject.image_names)
    ? rowObject.image_names
    : rowObject.imageBase;
  const sortOrder = parseNumber(rowObject.sortOrder, 999999);

  const payload = {
    id,
    stock_code: id,
    sku,
    manufacturerCode: toText(rowObject.manufacturerCode) || sku,
    slug: toText(rowObject.slug) || slugify(rowObject.name_tr || rowObject.name || id, id),
    name: toText(rowObject.name),
    name_tr: toText(rowObject.name_tr),
    unit: toText(rowObject.unit),
    brand: toText(rowObject.brand),
    price: parseNumber(rowObject.price, null),
    group: toText(rowObject.group),
    category,
    subcategory,
    main_category: category,
    sub_category: subcategory,
    groupKey: toText(rowObject.groupKey),
    categoryKey: toText(rowObject.categoryKey),
    subcategoryKey: toText(rowObject.subcategoryKey),
    shortDescription: toText(rowObject.shortDescription),
    description: normalizeLineBreaks(rowObject.description),
    specs: normalizeLineBreaks(rowObject.specs),
    highlightLines: normalizeLineBreaks(rowObject.highlightLines),
    searchText: toText(rowObject.searchText),
    seoTitle: toText(rowObject.seoTitle),
    metaDescription: toText(rowObject.metaDescription),
    imageBase: toText(rowObject.imageBase),
    image_names: parseImageNames(imageSource),
    active: parseBoolean(rowObject.active, true),
    webPublished: parseBoolean(rowObject.webPublished, true),
    badge: toText(rowObject.badge),
    isNew: parseBoolean(rowObject.isNew, false),
    popular: parsePopular(rowObject.popular),
    order: sortOrder,
    sortOrder,
    binding_codes: splitList(rowObject.binding_codes),
    material: toText(rowObject.material),
    packQty: parseNumber(rowObject.packQty, null),
    caseQty: parseNumber(rowObject.caseQty, null),
    unitType: toText(rowObject.unitType),
    dimensions: toText(rowObject.dimensions),
    capacity: toText(rowObject.capacity),
    power: toText(rowObject.power),
    voltage: toText(rowObject.voltage),
    fuelType: toText(rowObject.fuelType),
    weight: toText(rowObject.weight),
    warranty: toText(rowObject.warranty),
    technicalPdf: toText(rowObject.technicalPdf),
    catalogPdf: toText(rowObject.catalogPdf),
    videoUrl: toText(rowObject.videoUrl),
    tags: splitList(rowObject.tags),
    productType: toText(rowObject.productType) || "sale_item",
    stockTracked: parseBoolean(rowObject.stockTracked, true),
    saleEnabled: parseBoolean(rowObject.saleEnabled, true),
    purchaseEnabled: parseBoolean(rowObject.purchaseEnabled, true),
    vatRate: parseNumber(rowObject.vatRate, 16),
  };

  Object.entries(rowObject).forEach(([header, value]) => {
    if (!MANAGED_HEADERS.has(header) && hasValue(value)) {
      payload[header] = inferExtraValue(value);
    }
  });

  return payload;
}

async function importProductsFromWorkbook({
  adminDb,
  workbook,
  sourceLabel,
  sheetName = DEFAULT_SHEET_NAME,
  dryRun = false,
  requestedBy = "",
}) {
  const resolvedSheetName = toText(sheetName) || DEFAULT_SHEET_NAME;
  const worksheet = workbook.Sheets[resolvedSheetName];

  if (!worksheet) {
    throw new Error(`Sayfa bulunamadi: ${resolvedSheetName}`);
  }

  const rows = xlsx.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const headers = (rows[HEADER_ROW_INDEX] || []).map((header) => toText(header));

  if (!headers.length || !headers.some(Boolean)) {
    throw new Error("Excel baslik satiri okunamadi.");
  }

  const validationErrors = [];
  const importedProducts = new Map();
  const duplicateRowMap = new Map();

  rows.slice(DATA_START_ROW_INDEX).forEach((row, index) => {
    const excelRowNumber = DATA_START_ROW_INDEX + index + 1;

    if (!Array.isArray(row) || isRowEmpty(row)) {
      return;
    }

    try {
      const rowObject = buildRowObject(headers, row);
      const payload = buildProductPayload(rowObject, excelRowNumber);

      if (duplicateRowMap.has(payload.id)) {
        throw new Error(
          `Satir ${excelRowNumber}: '${payload.id}' dokuman kimligi daha once ${duplicateRowMap.get(payload.id)}. satirda da kullanilmis.`
        );
      }

      duplicateRowMap.set(payload.id, excelRowNumber);
      importedProducts.set(payload.id, payload);
    } catch (error) {
      validationErrors.push(error.message || `Satir ${excelRowNumber}: gecersiz veri.`);
    }
  });

  if (!importedProducts.size) {
    validationErrors.push("Excel icinde ice aktarilacak urun bulunamadi.");
  }

  if (validationErrors.length) {
    throw new ImportValidationError("Excel verisi dogrulanamadi.", validationErrors);
  }

  const snapshot = await adminDb.collection("products").get();
  const existingDocs = new Map(snapshot.docs.map((doc) => [doc.id, doc.data()]));

  const createdIds = [];
  const updatedIds = [];
  const unchangedIds = [];

  importedProducts.forEach((payload, id) => {
    const existingData = existingDocs.get(id);

    if (!existingData) {
      createdIds.push(id);
      return;
    }

    const existingComparable = pickComparableSnapshot(existingData, payload);
    const incomingComparable = normalizeForCompare(payload);

    if (JSON.stringify(existingComparable) === JSON.stringify(incomingComparable)) {
      unchangedIds.push(id);
    } else {
      updatedIds.push(id);
    }
  });

  const deletedIds = Array.from(existingDocs.keys()).filter((id) => !importedProducts.has(id));

  if (!dryRun) {
    const writer = adminDb.bulkWriter();

    createdIds.forEach((id) => {
      writer.set(
        adminDb.collection("products").doc(id),
        {
          ...importedProducts.get(id),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          importedAt: FieldValue.serverTimestamp(),
          importedBy: requestedBy || "system",
        },
        { merge: true }
      );
    });

    updatedIds.forEach((id) => {
      writer.set(
        adminDb.collection("products").doc(id),
        {
          ...importedProducts.get(id),
          updatedAt: FieldValue.serverTimestamp(),
          importedAt: FieldValue.serverTimestamp(),
          importedBy: requestedBy || "system",
        },
        { merge: true }
      );
    });

    deletedIds.forEach((id) => {
      writer.delete(adminDb.collection("products").doc(id));
    });

    await writer.close();
  }

  return {
    excelPath: sourceLabel,
    sheetName: resolvedSheetName,
    dryRun,
    totals: {
      excelRows: importedProducts.size,
      firestoreBefore: existingDocs.size,
      created: createdIds.length,
      updated: updatedIds.length,
      unchanged: unchangedIds.length,
      deleted: deletedIds.length,
      firestoreAfter: importedProducts.size,
    },
    createdIds: createdIds.slice(0, 50),
    updatedIds: updatedIds.slice(0, 50),
    deletedIds: deletedIds.slice(0, 50),
    unchangedIds: unchangedIds.slice(0, 50),
  };
}

export async function importProductsFromExcel({
  adminDb,
  excelPath = DEFAULT_IMPORT_PATH,
  sheetName = DEFAULT_SHEET_NAME,
  dryRun = false,
  requestedBy = "",
}) {
  const resolvedPath = resolveExcelPath(toText(excelPath) || DEFAULT_IMPORT_PATH);
  const workbook = xlsx.readFile(resolvedPath);

  return importProductsFromWorkbook({
    adminDb,
    workbook,
    sourceLabel: resolvedPath,
    sheetName,
    dryRun,
    requestedBy,
  });
}

export async function importProductsFromFileBuffer({
  adminDb,
  fileBuffer,
  fileName = "uploaded.xlsx",
  sheetName = DEFAULT_SHEET_NAME,
  dryRun = false,
  requestedBy = "",
}) {
  const workbook = xlsx.read(fileBuffer, { type: "buffer" });

  return importProductsFromWorkbook({
    adminDb,
    workbook,
    sourceLabel: `[uploaded] ${toText(fileName) || "uploaded.xlsx"}`,
    sheetName,
    dryRun,
    requestedBy,
  });
}

export { ImportValidationError };
