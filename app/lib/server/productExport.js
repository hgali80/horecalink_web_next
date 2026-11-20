import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import * as xlsx from "xlsx";
import { DEFAULT_SHEET_NAME } from "./productImport";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "app",
  "lib",
  "server",
  "templates",
  "horecalink_product_import_v1.xlsx"
);
const PRODUCT_HEADER_ROW = 4;
const PRODUCT_START_ROW = 6;
const VALIDATION_BASE_END_ROW = 1461;
const PRODUCT_SHEET_XML_PATH = "xl/worksheets/sheet1.xml";

function decodeXml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function encodeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseAttributes(attributeText) {
  return Array.from(attributeText.matchAll(/([^\s=]+)="([^"]*)"/g), (match) => [
    match[1],
    decodeXml(match[2]),
  ]);
}

function getAttribute(attributes, name) {
  return attributes.find(([key]) => key === name)?.[1];
}

function columnNumber(cellReference) {
  const letters = cellReference.match(/^[A-Z]+/)?.[0] || "";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
}

function columnName(number) {
  let value = number;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function readRows(sheetDataXml) {
  const rows = new Map();
  for (const match of sheetDataXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const attributes = parseAttributes(match[1]);
    const rowNumber = Number(getAttribute(attributes, "r"));
    const cells = new Map();

    for (const cellMatch of match[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const cellAttributes = parseAttributes(cellMatch[1]);
      const reference = getAttribute(cellAttributes, "r");
      if (!reference) continue;
      cells.set(columnNumber(reference), cellAttributes);
    }

    rows.set(rowNumber, { attributes, cells, raw: match[0] });
  }
  return rows;
}

function serializeCell(reference, sourceAttributes, value) {
  const attributes = sourceAttributes
    .filter(([key]) => key !== "r" && key !== "t")
    .map(([key, attributeValue]) => `${key}="${encodeXml(attributeValue)}"`);
  attributes.unshift(`r="${reference}"`);

  if (value === null || value === undefined || value === "") {
    return `<c ${attributes.join(" ")}/>`;
  }

  if (typeof value === "boolean") {
    return `<c ${attributes.join(" ")} t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c ${attributes.join(" ")}><v>${value}</v></c>`;
  }

  const text = String(value);
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return `<c ${attributes.join(" ")} t="inlineStr"><is><t${space}>${encodeXml(text)}</t></is></c>`;
}

function serializeRow(rowNumber, rowInfo, columnCount, values = null, fallbackRow = null) {
  const source = rowInfo || fallbackRow || { attributes: [], cells: new Map() };
  const attributes = source.attributes
    .filter(([key]) => key !== "r")
    .map(([key, value]) => `${key}="${encodeXml(value)}"`);
  attributes.unshift(`r="${rowNumber}"`);

  const cells = [];
  for (let column = 1; column <= columnCount; column += 1) {
    const cellAttributes = source.cells.get(column) || fallbackRow?.cells.get(column) || [];
    const value = values ? values[column - 1] : null;
    cells.push(serializeCell(`${columnName(column)}${rowNumber}`, cellAttributes, value));
  }

  return `<row ${attributes.join(" ")}>${cells.join("")}</row>`;
}

function updateValidationRanges(sheetXml, endRow) {
  return sheetXml.replace(/<dataValidation\b([^>]*)>([\s\S]*?)<\/dataValidation>/g, (whole, rawAttributes, body) => {
    const attributes = parseAttributes(rawAttributes);
    const oldRange = getAttribute(attributes, "sqref") || "";
    const columns = new Set();

    for (const reference of oldRange.split(/\s+/).filter(Boolean)) {
      const [start, end = start] = reference.split(":");
      const startColumn = columnNumber(start);
      const endColumn = columnNumber(end);
      for (let column = startColumn; column <= endColumn; column += 1) columns.add(column);
    }

    if (!columns.size) return whole;

    const newRange = [...columns]
      .sort((a, b) => a - b)
      .map((column) => `${columnName(column)}${PRODUCT_START_ROW}:${columnName(column)}${endRow}`)
      .join(" ");
    const serializedAttributes = attributes
      .map(([key, value]) => `${key}="${encodeXml(key === "sqref" ? newRange : value)}"`)
      .join(" ");

    return `<dataValidation ${serializedAttributes}>${body}</dataValidation>`;
  });
}

function enableFormulaRecalculation(workbookXml) {
  if (/<calcPr\b[^>]*\/>/.test(workbookXml)) {
    return workbookXml.replace(/<calcPr\b([^>]*)\/>/, (_match, rawAttributes) => {
      const attributes = new Map(parseAttributes(rawAttributes));
      attributes.set("calcMode", "auto");
      attributes.set("fullCalcOnLoad", "1");
      attributes.set("forceFullCalc", "1");
      return `<calcPr ${[...attributes]
        .map(([key, value]) => `${key}="${encodeXml(value)}"`)
        .join(" ")}/>`;
    });
  }

  return workbookXml.replace(
    "</workbook>",
    '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'
  );
}

function getCellValue(product, header) {
  switch (header) {
    case "id":
      return product.id;
    case "sku":
      return product.sku || product.stock_code || product.id;
    case "category":
      return product.category ?? product.main_category ?? "";
    case "subcategory":
      return product.subcategory ?? product.sub_category ?? "";
    case "sortOrder":
      return product.sortOrder ?? product.order ?? "";
    default:
      return product[header] ?? "";
  }
}

function normalizeValue(value, header) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join("\n");
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && ["createdAt", "updatedAt"].includes(header)) return value;
  return value;
}

export function createProductExportRows(products, headers) {
  return products.map((product) => headers.map((header) => normalizeValue(getCellValue(product, header), header)));
}

export async function exportProductsToExcel(adminDb) {
  const [templateBuffer, snapshot] = await Promise.all([
    fs.readFile(TEMPLATE_PATH),
    adminDb.collection("products").get(),
  ]);

  const templateWorkbook = xlsx.read(templateBuffer, { type: "buffer" });
  const productSheet = templateWorkbook.Sheets[DEFAULT_SHEET_NAME];
  if (!productSheet) throw new Error(`Excel sablonunda sayfa bulunamadi: ${DEFAULT_SHEET_NAME}`);

  const headerRows = xlsx.utils.sheet_to_json(productSheet, {
    header: 1,
    range: PRODUCT_HEADER_ROW - 1,
    defval: "",
  });
  const headers = (headerRows[0] || []).map((value) => String(value ?? "").trim());
  if (!headers.some(Boolean)) throw new Error("Excel sablonundaki urun basliklari okunamadi.");

  const products = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "tr"));
  const productRows = createProductExportRows(products, headers);
  const productSheetXmlFile = await JSZip.loadAsync(templateBuffer);
  const productSheetXml = productSheetXmlFile.file(PRODUCT_SHEET_XML_PATH);
  const workbookXmlFile = productSheetXmlFile.file("xl/workbook.xml");
  if (!productSheetXml || !workbookXmlFile) throw new Error("Excel sablon dosyasi okunamadi.");

  const [originalSheetXml, originalWorkbookXml] = await Promise.all([
    productSheetXml.async("string"),
    workbookXmlFile.async("string"),
  ]);
  const sheetDataMatch = originalSheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!sheetDataMatch) throw new Error("Excel sablonunda urun satirlari bulunamadi.");

  const rows = readRows(sheetDataMatch[1]);
  const templateLastRow = Math.max(...rows.keys());
  const dataLastRow = PRODUCT_START_ROW + productRows.length - 1;
  const outputLastRow = Math.max(templateLastRow, dataLastRow);
  const validationLastRow = Math.max(VALIDATION_BASE_END_ROW, dataLastRow);
  const fallbackRow = rows.get(PRODUCT_START_ROW);
  const serializedRows = [];

  for (let rowNumber = 1; rowNumber < PRODUCT_START_ROW; rowNumber += 1) {
    const rowInfo = rows.get(rowNumber);
    if (rowInfo) serializedRows.push(rowInfo.raw);
  }

  for (let rowNumber = PRODUCT_START_ROW; rowNumber <= outputLastRow; rowNumber += 1) {
    const rowInfo = rows.get(rowNumber);
    const productValues = productRows[rowNumber - PRODUCT_START_ROW] || null;
    serializedRows.push(
      serializeRow(rowNumber, rowInfo, headers.length, productValues, fallbackRow)
    );
  }

  let updatedSheetXml = originalSheetXml.replace(
    /<sheetData>[\s\S]*?<\/sheetData>/,
    `<sheetData>${serializedRows.join("")}</sheetData>`
  );
  updatedSheetXml = updateValidationRanges(updatedSheetXml, validationLastRow);
  const lastColumn = columnName(headers.length);
  updatedSheetXml = updatedSheetXml.replace(
    /(<dimension\b[^>]*\bref=")[^"]+("[^>]*\/>)/,
    `$1A1:${lastColumn}${outputLastRow}$2`
  );

  productSheetXmlFile.file(PRODUCT_SHEET_XML_PATH, updatedSheetXml);
  productSheetXmlFile.file("xl/workbook.xml", enableFormulaRecalculation(originalWorkbookXml));
  return productSheetXmlFile.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
