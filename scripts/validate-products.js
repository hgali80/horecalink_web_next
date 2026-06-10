//scripts/validate-products.js
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

console.log("SCRIPT BASLADI");

const EXCEL_PATH = path.join(
  __dirname,
  "..",
  "horecalink_urunleri_tam_liste.xlsx"
);

const ALLOWED_GROUP_KEYS = new Set([
  "institutional",
  "equipment",
  "stainless",
]);

const REQUIRED_FIELDS = [
  "id",
  "slug",
  "name",
  "groupKey",
  "categoryKey",
  "subcategoryKey",
  "imageBase",
  "active",
  "webPublished",
];

const NUMERIC_FIELDS = ["price", "vatRate", "sortOrder"];

const BOOLEAN_FIELDS = [
  "active",
  "webPublished",
  "stockTracked",
  "saleEnabled",
  "purchaseEnabled",
];

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase();
}

function isValidBoolean(value) {
  if (typeof value === "boolean") return true;
  const v = String(value).trim().toLowerCase();
  return ["true", "false", "1", "0", "yes", "no"].includes(v);
}

function isValidNumber(value) {
  if (isEmpty(value)) return true;
  if (typeof value === "number") return Number.isFinite(value);

  const normalized = String(value).replace(",", ".").trim();
  return normalized !== "" && !Number.isNaN(Number(normalized));
}

function isValidSlug(value) {
  const slug = normalizeString(value);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function parseBindingCodes(value) {
  if (isEmpty(value)) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidBindingCodes(value) {
  if (isEmpty(value)) return true;
  const items = parseBindingCodes(value);
  if (items.length === 0) return true;
  return items.every((item) => /^\d+$/.test(item));
}

function addIssue(target, rowNumber, type, field, message, value) {
  target.push({
    rowNumber,
    type,
    field,
    message,
    value: value ?? "",
  });
}

function findHeaderRow(aoa) {
  for (let i = 0; i < aoa.length; i++) {
    const row = (aoa[i] || []).map((cell) => normalizeString(cell).toLowerCase());

    const hasId = row.includes("id");
    const hasSlug = row.includes("slug");
    const hasName = row.includes("name");
    const hasGroupKey = row.includes("groupkey");
    const hasCategoryKey = row.includes("categorykey");
    const hasSubcategoryKey = row.includes("subcategorykey");

    if (
      hasId &&
      hasSlug &&
      hasName &&
      hasGroupKey &&
      hasCategoryKey &&
      hasSubcategoryKey
    ) {
      return i;
    }
  }
  return -1;
}

function isInstructionRow(row) {
  const values = Object.values(row)
    .map((v) => normalizeString(v).toLowerCase())
    .filter(Boolean);

  if (values.length === 0) return true;

  const joined = values.join(" | ");

  const instructionMarkers = [
    "true/false kullan",
    "sabit sistem anahtarı",
    "dil bağımsız olmalı",
    "ürün fiyatı",
    "liste sırası",
    "url için seo uyumlu",
    "satış akışında kullanılabilir mi",
    "stok takibi yapılsın mı",
    "ürün web sitesinde yayınlansın mı",
    "benzer ürünlerde",
    "virgülle ayır",
  ];

  return instructionMarkers.some((marker) => joined.includes(marker));
}

function isMeaningfulProductRow(row) {
  const id = normalizeString(row.id);
  const slug = normalizeString(row.slug);
  const name = normalizeString(row.name);
  const groupKey = normalizeString(row.groupKey);
  const categoryKey = normalizeString(row.categoryKey);
  const subcategoryKey = normalizeString(row.subcategoryKey);

  return Boolean(id || slug || name || groupKey || categoryKey || subcategoryKey);
}

function printGroupedSummary(errors, warnings) {
  const summarize = (items) => {
    const map = new Map();

    for (const item of items) {
      const key = `${item.field} | ${item.message}`;
      map.set(key, (map.get(key) || 0) + 1);
    }

    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const errorSummary = summarize(errors);
  const warningSummary = summarize(warnings);

  console.log("\nHATA OZETI:");
  if (errorSummary.length === 0) {
    console.log("- Hata yok");
  } else {
    errorSummary.slice(0, 20).forEach(([key, count]) => {
      console.log(`- ${count}x ${key}`);
    });
  }

  console.log("\nUYARI OZETI:");
  if (warningSummary.length === 0) {
    console.log("- Uyarı yok");
  } else {
    warningSummary.slice(0, 20).forEach(([key, count]) => {
      console.log(`- ${count}x ${key}`);
    });
  }
}

function main() {
  console.log("MAIN CALISTI");
  console.log("EXCEL_PATH:", EXCEL_PATH);

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Excel dosyası bulunamadı: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const headerRowIndex = findHeaderRow(aoa);

  if (headerRowIndex === -1) {
    console.error(
      "Başlık satırı bulunamadı. id, slug, name, groupKey, categoryKey, subcategoryKey başlıklarını kontrol et."
    );
    process.exit(1);
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    range: headerRowIndex,
    defval: "",
    raw: false,
  });

  const rows = rawRows
    .filter(isMeaningfulProductRow)
    .filter((row) => !isInstructionRow(row));

  console.log("OKUNAN SHEET:", sheetName);
  console.log("HEADER SATIRI:", headerRowIndex + 1);
  console.log("OKUNAN URUN SATIRI SAYISI:", rows.length);

  const errors = [];
  const warnings = [];

  const idMap = new Map();
  const slugMap = new Map();

  rows.forEach((row, index) => {
    const rowNumber = headerRowIndex + index + 2;

    for (const field of REQUIRED_FIELDS) {
      if (isEmpty(row[field])) {
        addIssue(
          errors,
          rowNumber,
          "error",
          field,
          `${field} boş olamaz`,
          row[field]
        );
      }
    }

    const normalizedGroupKey = normalizeKey(row.groupKey);
    if (!isEmpty(row.groupKey) && !ALLOWED_GROUP_KEYS.has(normalizedGroupKey)) {
      addIssue(
        errors,
        rowNumber,
        "error",
        "groupKey",
        `groupKey geçersiz. İzin verilenler: ${[...ALLOWED_GROUP_KEYS].join(", ")}`,
        row.groupKey
      );
    }

    if (!isEmpty(row.categoryKey) && !isValidSlug(row.categoryKey)) {
      addIssue(
        errors,
        rowNumber,
        "error",
        "categoryKey",
        "categoryKey küçük harf, rakam ve tire formatında olmalı",
        row.categoryKey
      );
    }

    if (!isEmpty(row.subcategoryKey) && !isValidSlug(row.subcategoryKey)) {
      addIssue(
        errors,
        rowNumber,
        "error",
        "subcategoryKey",
        "subcategoryKey küçük harf, rakam ve tire formatında olmalı",
        row.subcategoryKey
      );
    }

    for (const field of NUMERIC_FIELDS) {
      if (!isValidNumber(row[field])) {
        addIssue(
          errors,
          rowNumber,
          "error",
          field,
          `${field} sayısal olmalı`,
          row[field]
        );
      }
    }

    if (!isValidBindingCodes(row.binding_codes)) {
      addIssue(
        errors,
        rowNumber,
        "error",
        "binding_codes",
        "binding_codes sadece rakam ve virgül içermeli. Örn: 22,25,38",
        row.binding_codes
      );
    }

    for (const field of BOOLEAN_FIELDS) {
      if (!isEmpty(row[field]) && !isValidBoolean(row[field])) {
        addIssue(
          errors,
          rowNumber,
          "error",
          field,
          `${field} true/false tipinde olmalı`,
          row[field]
        );
      }
    }

    if (!isEmpty(row.slug) && !isValidSlug(row.slug)) {
      addIssue(
        errors,
        rowNumber,
        "error",
        "slug",
        "slug sadece küçük harf, rakam ve tire içermeli",
        row.slug
      );
    }

    if (!isEmpty(row.imageBase)) {
      const imageBase = normalizeString(row.imageBase).toLowerCase();
      if (
        imageBase.endsWith(".jpg") ||
        imageBase.endsWith(".jpeg") ||
        imageBase.endsWith(".png") ||
        imageBase.endsWith(".webp")
      ) {
        addIssue(
          warnings,
          rowNumber,
          "warning",
          "imageBase",
          "imageBase dosya uzantısı içermemeli, sadece temel ad olmalı",
          row.imageBase
        );
      }
    }

    const id = normalizeString(row.id);
    if (id) {
      if (!idMap.has(id)) idMap.set(id, []);
      idMap.get(id).push(rowNumber);
    }

    const slug = normalizeString(row.slug);
    if (slug) {
      if (!slugMap.has(slug)) slugMap.set(slug, []);
      slugMap.get(slug).push(rowNumber);
    }

    if (isEmpty(row.price)) {
      addIssue(
        warnings,
        rowNumber,
        "warning",
        "price",
        "price boş, ürün kartında fiyat yerine teklif CTA gösterilmesi gerekir",
        row.price
      );
    }

    if (isEmpty(row.brand)) {
      addIssue(
        warnings,
        rowNumber,
        "warning",
        "brand",
        "brand boş",
        row.brand
      );
    }

    if (isEmpty(row.binding_codes)) {
      addIssue(
        warnings,
        rowNumber,
        "warning",
        "binding_codes",
        "binding_codes boş, ilgili ürünler alanında ilişki kurulmaz",
        row.binding_codes
      );
    }

    if (isEmpty(row.vatRate)) {
      addIssue(
        warnings,
        rowNumber,
        "warning",
        "vatRate",
        "vatRate boş, import sırasında default değer atanmalı",
        row.vatRate
      );
    }

    if (isEmpty(row.sortOrder)) {
      addIssue(
        warnings,
        rowNumber,
        "warning",
        "sortOrder",
        "sortOrder boş, listeleme sırası default davranışa kalır",
        row.sortOrder
      );
    }
  });

  for (const [id, rowsOfId] of idMap.entries()) {
    if (rowsOfId.length > 1) {
      rowsOfId.forEach((rowNumber) => {
        addIssue(
          errors,
          rowNumber,
          "error",
          "id",
          `Aynı id birden fazla kez kullanılmış: ${id}`,
          id
        );
      });
    }
  }

  for (const [slug, rowsOfSlug] of slugMap.entries()) {
    if (rowsOfSlug.length > 1) {
      rowsOfSlug.forEach((rowNumber) => {
        addIssue(
          errors,
          rowNumber,
          "error",
          "slug",
          `Aynı slug birden fazla kez kullanılmış: ${slug}`,
          slug
        );
      });
    }
  }

  const report = {
    checkedAt: new Date().toISOString(),
    file: EXCEL_PATH,
    sheet: sheetName,
    headerRow: headerRowIndex + 1,
    totalRows: rows.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
  };

  const reportPath = path.join(__dirname, "validation-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("Validation tamamlandı.");
  console.log(`Toplam ürün satırı: ${rows.length}`);
  console.log(`Hata: ${errors.length}`);
  console.log(`Uyarı: ${warnings.length}`);
  console.log(`Rapor: ${reportPath}`);

  printGroupedSummary(errors, warnings);

  if (errors.length > 0) {
    console.log("\nİlk 20 hata:");
    errors.slice(0, 20).forEach((item) => {
      console.log(
        `- Satır ${item.rowNumber} | ${item.field} | ${item.message} | Değer: ${item.value}`
      );
    });
    process.exit(1);
  }

  console.log("VALIDATION BASARILI, IMPORT ASAMASINA GECILEBILIR.");
}

main();
