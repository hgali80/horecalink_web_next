// app/lib/catalog/catalogLabels.js

import { categoryMap } from "../../data/categoryMap";
import { categoryTranslationOverrides } from "./catalogTranslationOverrides";

const LABELS_BY_LANG = {
  accessories: {
    tr: "Aksesuar",
    ru: "Аксессуары",
    kz: "Аксессуарлар",
    en: "Accessories",
  },
  "beverage-equipment": {
    tr: "İçecek Hazırlama",
    ru: "Приготовление напитков",
    kz: "Сусын дайындау",
    en: "Beverage Preparation",
  },
  cookware: {
    tr: "Tencere ve Tavalar",
    ru: "Кастрюли и сковороды",
    kz: "Кәстрөлдер мен табалар",
    en: "Cookware",
  },
  "prep-equipment": {
    tr: "Hazırlık Ekipmanları",
    ru: "Подготовительное оборудование",
    kz: "Дайындау жабдықтары",
    en: "Prep Equipment",
  },
  "prep-tools": {
    tr: "Hazırlık Araçları",
    ru: "Инструменты подготовки",
    kz: "Дайындау құралдары",
    en: "Prep Tools",
  },
  refrigeration: {
    tr: "Soğutma",
    ru: "Охлаждение",
    kz: "Салқындату",
    en: "Refrigeration",
  },
  "service-tools": {
    tr: "Servis",
    ru: "Сервис",
    kz: "Қызмет көрсету",
    en: "Service Tools",
  },
  "washing-equipment": {
    tr: "Yıkama",
    ru: "Мойка",
    kz: "Жуу",
    en: "Washing Equipment",
  },
  counters: {
    tr: "Tezgahlar",
    ru: "Столы",
    kz: "Үстелдер",
    en: "Counters",
  },
  "prep-stations": {
    tr: "Hazırlık İstasyonları",
    ru: "Станции подготовки",
    kz: "Дайындау станциялары",
    en: "Prep Stations",
  },
  "spare-parts": {
    tr: "Yedek Parçalar",
    ru: "Запасные части",
    kz: "Қосалқы бөлшектер",
    en: "Spare Parts",
  },
  "tea-coffee-dispensers": {
    tr: "İçecek Ekipmanları",
    ru: "Оборудование для напитков",
    kz: "Сусын жабдықтары",
    en: "Beverage Equipment",
  },
  "cookers-grills": {
    tr: "Pişirme Ekipmanları",
    ru: "Оборудование для приготовления",
    kz: "Пісіру жабдықтары",
    en: "Cooking Equipment",
  },
  "pots-pans": {
    tr: "Tencere ve Tavalar",
    ru: "Кастрюли и сковороды",
    kz: "Кәстрөлдер мен табалар",
    en: "Pots & Pans",
  },
  "food-prep-machines": {
    tr: "Hazırlık Ekipmanları",
    ru: "Подготовительное оборудование",
    kz: "Дайындау жабдықтары",
    en: "Food Prep Machines",
  },
  "cutting-boards": {
    tr: "Kesme Tahtaları",
    ru: "Разделочные доски",
    kz: "Кесу тақталары",
    en: "Cutting Boards",
  },
  knives: {
    tr: "Bıçaklar",
    ru: "Ножи",
    kz: "Пышақтар",
    en: "Knives",
  },
  utensils: {
    tr: "Mutfak Aparatları",
    ru: "Кухонные принадлежности",
    kz: "Асүй құралдары",
    en: "Utensils",
  },
  "coolers-ice-machines": {
    tr: "Soğutma Ekipmanları",
    ru: "Холодильное оборудование",
    kz: "Салқындату жабдықтары",
    en: "Cooling Equipment",
  },
  "dispensers-containers": {
    tr: "Servis Kapları",
    ru: "Сервировочные емкости",
    kz: "Сервис ыдыстары",
    en: "Dispensers & Containers",
  },
  "gastronorm-pans": {
    tr: "Gastronorm Küvetler",
    ru: "Гастроемкости",
    kz: "Gastronorm ыдыстары",
    en: "Gastronorm Pans",
  },
  "dishwashers-sterilizers": {
    tr: "Yıkama Ekipmanları",
    ru: "Моечное оборудование",
    kz: "Жуу жабдықтары",
    en: "Dishwashers & Sterilizers",
  },
  "worktables-stands": {
    tr: "Tezgah ve Standlar",
    ru: "Столы и подставки",
    kz: "Үстелдер мен тіректер",
    en: "Worktables & Stands",
  },
  "equipment-accessories": {
    tr: "Cihaz Aksesuarları",
    ru: "Аксессуары для оборудования",
    kz: "Жабдық аксессуарлары",
    en: "Equipment Accessories",
  },
};

const GROUP_KEY_ALIASES = {
  stainless: "stainless_steel",
  paslanmaz: "stainless_steel",
};

const MAIN_KEY_ALIASES = {
  "storage-and-transport": "storage_transport",
};

const SUBCATEGORY_KEY_ALIASES = {
  "tuvalet-kagitlari": "toilet_paper",
  "kagit-havlular": "paper_towels",
  peceteler: "napkins",
  "klozet-kapagi-hijyen-kagitlari": "toilet_seat_hygiene_covers",
  "sivi-ve-kopuk-sabunlar": "liquid_foam_soap",
  "sampuan-ve-dus-jelleri": "shampoo_shower_gel",
  "oda-kokulari": "air_fresheners",
  "islak-havlu-ve-mendiller": "wet_wipes",
  dezenfektanlar: "disinfectants",
  "mutfak-temizlik-ekipmanlari": "kitchen_cleaning_equipment",
  "yuzey-temizlik-bezleri": "surface_cleaning_cloths",
  "zemin-temizlik-ekipmanlari": "floor_cleaning_equipment",
  "cam-temizlik-ekipmanlari": "glass_cleaning_equipment",
  "wc-ve-banyo-temizlik-ekipmanlari": "wc_bathroom_cleaning_equipment",
  "mutfak-temizlik-urunleri": "kitchen_cleaning_chemicals",
  "zemin-temizlik-urunleri": "floor_cleaning_chemicals",
  "camasirhane-urunleri": "laundry_products",
  "wc-ve-banyo-temizlik-kimyasallari": "wc_bathroom_cleaning_chemicals",
  "cam-temizlik-urunleri": "glass_cleaning_chemicals",
  "havuz-urunleri": "pool_chemicals",
  maskeler: "masks",
  boneler: "hair_nets",
  onlukler: "aprons",
  galoslar: "shoe_covers",
  eldiven: "gloves",
  sekerler: "sugar_packets",
  "islak-mendiller": "wet_wipes_portion",
  bardaklar: "cups",
  "aluminyum-konteyner": "aluminum_containers",
  "catal-bicak-kasik": "cutlery_sets",
  kurdanlar: "toothpicks",
  "pipet-ve-karistirici": "stirrers_straws",
  "tuvalet-kagidi-dispenseri": "toilet_paper_dispensers",
  "kagit-havlu-dispenseri": "paper_towel_dispensers",
  "masaustu-pecete-dispenseri": "tabletop_napkin_dispensers",
  "sivi-sabun-dispenserleri": "liquid_soap_dispensers",
  "kopuk-sabun-dispenserleri": "foam_soap_dispensers",
  "klozet-kapagi-kagidi-dispenserleri": "toilet_seat_cover_dispensers",
  "airfresh-dispenserleri": "air_freshener_dispensers",
  "aluminyum-folyolar": "aluminum_foils",
  "strec-filmler": "stretch_films",
  "pisirme-kagitlari": "baking_paper",
  "cop-torbasi-ve-posetler": "trash_bags",
  "paketleme-strec-filmleri": "packaging_stretch_films",
  "koli-bantlari": "packing_tapes",
};

function normalizeLookupValue(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function prettifyKey(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const GROUP_KEY_ALTERNATIVES = new Map([
  ["stainless", "paslanmaz"],
  ["stainless-steel", "paslanmaz"],
  ["stainless_steel", "paslanmaz"],
  ["paslanmaz", "paslanmaz"],
  ["paslanmaz-ekipmanlar", "paslanmaz"],
  ["equipment", "equipment"],
  ["ekipman", "equipment"],
  ["institutional", "institutional"],
  ["kurumsal", "institutional"],
  ["kurumsal-urunler", "institutional"],
]);

const categoryKeyIndex = new Map();
const subcategoryKeyIndex = new Map();

for (const [subcategoryKey, item] of Object.entries(categoryMap)) {
  const categoryKey = String(item?.categoryKey || "").trim();
  const groupKey = String(item?.groupKey || "").trim();
  const categoryLabel = String(item?.categoryLabel || "").trim();
  const subLabel = String(item?.subLabel || "").trim();

  if (categoryKey) {
    categoryKeyIndex.set(normalizeLookupValue(categoryKey), categoryKey);
  }

  if (categoryLabel) {
    categoryKeyIndex.set(normalizeLookupValue(categoryLabel), categoryKey);
  }

  if (subcategoryKey) {
    subcategoryKeyIndex.set(normalizeLookupValue(subcategoryKey), subcategoryKey);
  }

  if (subLabel) {
    subcategoryKeyIndex.set(normalizeLookupValue(subLabel), subcategoryKey);
  }

  if (groupKey) {
    GROUP_KEY_ALTERNATIVES.set(normalizeLookupValue(groupKey), normalizeCatalogGroupKey(groupKey));
  }

  if (item?.groupLabel) {
    GROUP_KEY_ALTERNATIVES.set(
      normalizeLookupValue(item.groupLabel),
      normalizeCatalogGroupKey(groupKey)
    );
  }
}

function translateKey(t, key) {
  if (!t || !key) return "";
  const translated = t(key);
  return translated !== key ? translated : "";
}

function getFallbackLabel(lang, key, fallback) {
  return LABELS_BY_LANG[key]?.[lang] || fallback || prettifyKey(key);
}

function getOverrideLabel(scope, key, lang) {
  return categoryTranslationOverrides?.[scope]?.[key]?.[lang] || "";
}

export function getGroupLabel({ t, lang, groupKey, fallback }) {
  const override = getOverrideLabel("group", groupKey, lang);
  if (override) return override;

  const direct = translateKey(t, `category.group.${groupKey}`);
  if (direct) return direct;

  const aliasKey = GROUP_KEY_ALIASES[groupKey];
  if (aliasKey) {
    const aliased = translateKey(t, `category.group.${aliasKey}`);
    if (aliased) return aliased;
  }

  return getFallbackLabel(lang, groupKey, fallback);
}

export function getMainCategoryLabel({ t, lang, categoryKey, fallback }) {
  const override = getOverrideLabel("main", categoryKey, lang);
  if (override) return override;

  const direct = translateKey(t, `category.main.${categoryKey}`);
  if (direct) return direct;

  const underscored = translateKey(t, `category.main.${String(categoryKey).replace(/-/g, "_")}`);
  if (underscored) return underscored;

  const aliasKey = MAIN_KEY_ALIASES[categoryKey];
  if (aliasKey) {
    const aliased = translateKey(t, `category.main.${aliasKey}`);
    if (aliased) return aliased;
  }

  const mapFallback =
    Object.values(categoryMap).find((item) => item?.categoryKey === categoryKey)?.categoryLabel || "";

  return getFallbackLabel(lang, categoryKey, fallback || mapFallback);
}

export function getSubcategoryLabel({ t, lang, subcategoryKey, fallback }) {
  const override = getOverrideLabel("sub", subcategoryKey, lang);
  if (override) return override;

  const direct =
    translateKey(t, `categories.sub.${subcategoryKey}`) ||
    translateKey(t, `category.sub.${subcategoryKey}`);
  if (direct) return direct;

  const aliasKey = SUBCATEGORY_KEY_ALIASES[subcategoryKey];
  if (aliasKey) {
    const aliased =
      translateKey(t, `categories.sub.${aliasKey}`) ||
      translateKey(t, `category.sub.${aliasKey}`);
    if (aliased) return aliased;
  }

  const mapFallback = categoryMap[subcategoryKey]?.subLabel || "";

  return getFallbackLabel(lang, subcategoryKey, fallback || mapFallback);
}

function readKnownKey(...values) {
  for (const value of values) {
    const key = String(value || "").trim();
    if (key && categoryMap[key]) {
      return key;
    }
  }

  return "";
}

export function normalizeCatalogGroupKey(value) {
  const normalized = normalizeLookupValue(value);
  return GROUP_KEY_ALTERNATIVES.get(normalized) || String(value || "").trim();
}

function resolveKnownCategoryKey(...values) {
  for (const value of values) {
    const exact = String(value || "").trim();
    if (exact && categoryKeyIndex.has(normalizeLookupValue(exact))) {
      return categoryKeyIndex.get(normalizeLookupValue(exact));
    }
  }

  return "";
}

function resolveKnownSubcategoryKey(...values) {
  const exactKey = readKnownKey(...values);
  if (exactKey) return exactKey;

  for (const value of values) {
    const exact = String(value || "").trim();
    if (exact && subcategoryKeyIndex.has(normalizeLookupValue(exact))) {
      return subcategoryKeyIndex.get(normalizeLookupValue(exact));
    }
  }

  return "";
}

export function resolveProductCategoryKeys(product) {
  const subcategoryKey = resolveKnownSubcategoryKey(
    product?.subcategoryKey,
    product?.sub_category,
    product?.subcategory
  );

  if (subcategoryKey) {
    const item = categoryMap[subcategoryKey];
    return {
      groupKey: normalizeCatalogGroupKey(item?.groupKey || product?.groupKey || product?.group),
      categoryKey: String(item?.categoryKey || product?.categoryKey || product?.main_category || "").trim(),
      subcategoryKey,
    };
  }

  const categoryKey = resolveKnownCategoryKey(
    product?.categoryKey,
    product?.main_category,
    product?.category
  );
  const groupKey = normalizeCatalogGroupKey(product?.groupKey || product?.group);

  if (categoryKey) {
    const inferredGroup =
      groupKey ||
      normalizeCatalogGroupKey(
        Object.values(categoryMap).find((item) => item?.categoryKey === categoryKey)?.groupKey
      );

    return {
      groupKey: inferredGroup,
      categoryKey,
      subcategoryKey: "",
    };
  }

  return {
    groupKey,
    categoryKey: String(product?.categoryKey || product?.main_category || product?.category || "").trim(),
    subcategoryKey: "",
  };
}
