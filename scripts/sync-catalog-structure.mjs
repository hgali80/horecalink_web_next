import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import xlsx from "xlsx";

const projectRoot = process.cwd();
const excelPath = process.argv[2];

if (!excelPath) {
  throw new Error("Excel dosya yolu gerekli: npm run sync:catalog -- <dosya.xlsx>");
}

const categoryMapPath = path.join(projectRoot, "app", "data", "categoryMap.js");
const categoryDataPath = path.join(projectRoot, "app", "data", "categoryData.js");
const existingMapModule = await import(pathToFileURL(categoryMapPath).href);
const existingMap = existingMapModule.categoryMap;

const workbook = xlsx.readFile(excelPath);
const sheet = workbook.Sheets.Urun_Sablonu;

if (!sheet) {
  throw new Error("Urun_Sablonu sayfasi bulunamadi.");
}

const rows = xlsx.utils.sheet_to_json(sheet, {
  defval: "",
  raw: false,
  range: 3,
});

function text(value) {
  return String(value || "").trim();
}

function prettify(value) {
  return text(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const existingGroupLabels = new Map();
const existingCategoryLabels = new Map();

for (const item of Object.values(existingMap)) {
  if (item.groupKey && item.groupLabel && !existingGroupLabels.has(item.groupKey)) {
    existingGroupLabels.set(item.groupKey, item.groupLabel);
  }
  const categoryIdentity = `${item.groupKey}/${item.categoryKey}`;
  if (item.categoryLabel && !existingCategoryLabels.has(categoryIdentity)) {
    existingCategoryLabels.set(categoryIdentity, item.categoryLabel);
  }
}

const tree = new Map();

// İlk satır Excel'deki alan açıklamalarıdır; ürün verisi değildir.
for (const row of rows.slice(1)) {
  const groupKey = text(row.groupKey);
  const categoryKey = text(row.categoryKey);
  const subcategoryKey = text(row.subcategoryKey);
  if (!groupKey || !categoryKey || !subcategoryKey) continue;

  if (!tree.has(groupKey)) tree.set(groupKey, new Map());
  const categories = tree.get(groupKey);
  if (!categories.has(categoryKey)) categories.set(categoryKey, new Map());

  const existing = existingMap[subcategoryKey];
  categories.get(categoryKey).set(subcategoryKey, {
    groupKey,
    categoryKey,
    groupLabel:
      existing?.groupLabel || existingGroupLabels.get(groupKey) || text(row.group) || prettify(groupKey),
    categoryLabel:
      existing?.categoryLabel ||
      existingCategoryLabels.get(`${groupKey}/${categoryKey}`) ||
      text(row.category) ||
      prettify(categoryKey),
    subLabel: existing?.subLabel || prettify(text(row.subcategory) || subcategoryKey),
  });
}

if (!tree.size) {
  throw new Error("Excel dosyasinda katalog anahtari bulunan urun yok.");
}

const nextCategoryMap = {};
const nextCategoryData = {};

for (const [groupKey, categories] of tree) {
  nextCategoryData[groupKey] = { mainCategories: {} };
  for (const [categoryKey, subcategories] of categories) {
    const subcategoryKeys = [...subcategories.keys()].sort((a, b) => a.localeCompare(b, "en"));
    nextCategoryData[groupKey].mainCategories[categoryKey] = subcategoryKeys;
    for (const subcategoryKey of subcategoryKeys) {
      nextCategoryMap[subcategoryKey] = subcategories.get(subcategoryKey);
    }
  }
}

function sortObject(input) {
  return Object.keys(input)
    .sort((a, b) => a.localeCompare(b, "en"))
    .reduce((result, key) => {
      result[key] = input[key];
      return result;
    }, {});
}

const sortedCategoryData = Object.fromEntries(
  Object.entries(nextCategoryData)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([groupKey, group]) => [
      groupKey,
      { mainCategories: sortObject(group.mainCategories) },
    ])
);

await fs.writeFile(
  categoryMapPath,
  `// app/data/categoryMap.js\n\nexport const categoryMap = ${JSON.stringify(
    sortObject(nextCategoryMap),
    null,
    2
  )};\n`,
  "utf8"
);

await fs.writeFile(
  categoryDataPath,
  `// app/data/categoryData.js\n\nexport const categoryData = ${JSON.stringify(
    sortedCategoryData,
    null,
    2
  )};\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      excelPath,
      groups: tree.size,
      categories: Object.values(sortedCategoryData).reduce(
        (total, group) => total + Object.keys(group.mainCategories).length,
        0
      ),
      subcategories: Object.keys(nextCategoryMap).length,
    },
    null,
    2
  )
);
