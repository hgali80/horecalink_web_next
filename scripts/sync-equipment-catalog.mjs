import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import xlsx from "xlsx";

const projectRoot = process.cwd();
const excelPath =
  process.argv[2] ||
  "C:\\Users\\hasan\\OneDrive\\Belgeler\\HORECL~1\\1-YENI~1\\horecalink_urunleri_tam_liste_v4.xlsx";

const categoryMapPath = path.join(projectRoot, "app", "data", "categoryMap.js");
const categoryDataPath = path.join(projectRoot, "app", "data", "categoryData.js");
const localeDir = path.join(projectRoot, "app", "locales");
const localeFiles = ["tr", "ru", "kz", "en"].map((lang) => ({
  lang,
  filePath: path.join(localeDir, `${lang}.json`),
}));

const categoryMapModule = await import(pathToFileURL(categoryMapPath).href);
const categoryDataModule = await import(pathToFileURL(categoryDataPath).href);

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

const equipmentRows = rows.filter(
  (row) => String(row.groupKey || "").trim() === "equipment"
);

if (!equipmentRows.length) {
  throw new Error("Excel dosyasinda equipment satiri bulunamadi.");
}

const equipmentTree = new Map();

for (const row of equipmentRows) {
  const groupLabel = String(row.group || "").trim();
  const categoryKey = String(row.categoryKey || "").trim();
  const categoryLabel = String(row.category || "").trim();
  const subcategoryKey = String(row.subcategoryKey || "").trim();
  const subcategoryLabel = String(row.subcategory || "").trim();

  if (!categoryKey || !subcategoryKey) continue;

  if (!equipmentTree.has(categoryKey)) {
    equipmentTree.set(categoryKey, {
      groupLabel,
      categoryLabel,
      subcategories: new Map(),
    });
  }

  equipmentTree.get(categoryKey).subcategories.set(subcategoryKey, subcategoryLabel);
}

const equipmentCategoryMapEntries = {};

for (const [categoryKey, categoryInfo] of equipmentTree.entries()) {
  for (const [subcategoryKey, subLabel] of categoryInfo.subcategories.entries()) {
    equipmentCategoryMapEntries[subcategoryKey] = {
      groupKey: "equipment",
      categoryKey,
      groupLabel: categoryInfo.groupLabel || "ekipman",
      categoryLabel: categoryInfo.categoryLabel,
      subLabel,
    };
  }
}

const nextCategoryMap = {};
for (const [key, value] of Object.entries(categoryMapModule.categoryMap)) {
  if (value?.groupKey === "equipment") continue;
  nextCategoryMap[key] = value;
}
Object.assign(nextCategoryMap, equipmentCategoryMapEntries);

const nextCategoryData = {
  ...categoryDataModule.categoryData,
  equipment: {
    ...categoryDataModule.categoryData.equipment,
    mainCategories: Object.fromEntries(
      [...equipmentTree.entries()].map(([categoryKey, categoryInfo]) => [
        categoryKey,
        [...categoryInfo.subcategories.keys()],
      ])
    ),
  },
};

function sortObject(input) {
  return Object.keys(input)
    .sort((a, b) => a.localeCompare(b, "en"))
    .reduce((acc, key) => {
      acc[key] = input[key];
      return acc;
    }, {});
}

function toModuleText(constName, value) {
  return `// app/data/${constName}.js\n\nexport const ${constName} = ${JSON.stringify(
    value,
    null,
    2
  )};\n`;
}

await fs.writeFile(
  categoryMapPath,
  toModuleText("categoryMap", nextCategoryMap),
  "utf8"
);
await fs.writeFile(
  categoryDataPath,
  toModuleText("categoryData", nextCategoryData),
  "utf8"
);

for (const { filePath } of localeFiles) {
  const localeTable = JSON.parse(await fs.readFile(filePath, "utf8"));

  const firstCategory = equipmentTree.values().next().value;
  if (firstCategory?.groupLabel) {
    localeTable["category.group.equipment"] =
      localeTable["category.group.equipment"] || firstCategory.groupLabel;
  }

  for (const [categoryKey, categoryInfo] of equipmentTree.entries()) {
    localeTable[`category.main.${categoryKey}`] =
      localeTable[`category.main.${categoryKey}`] || categoryInfo.categoryLabel;
    localeTable[`category.main.${categoryKey.replace(/-/g, "_")}`] =
      localeTable[`category.main.${categoryKey.replace(/-/g, "_")}`] || categoryInfo.categoryLabel;

    for (const [subcategoryKey, subLabel] of categoryInfo.subcategories.entries()) {
      localeTable[`category.sub.${subcategoryKey}`] =
        localeTable[`category.sub.${subcategoryKey}`] || subLabel;
      localeTable[`categories.sub.${subcategoryKey}`] =
        localeTable[`categories.sub.${subcategoryKey}`] || subLabel;
    }
  }

  await fs.writeFile(
    filePath,
    `${JSON.stringify(sortObject(localeTable), null, 2)}\n`,
    "utf8"
  );
}

console.log(
  JSON.stringify(
    {
      excelPath,
      categoryCount: equipmentTree.size,
      subcategoryCount: Object.keys(equipmentCategoryMapEntries).length,
    },
    null,
    2
  )
);
