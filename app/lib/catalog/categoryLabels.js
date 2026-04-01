// app/lib/catalog/categoryLabels.js

import { categoryMap } from "../../data/categoryMap";

function prettifyKey(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function translateLabel(t, key, fallback) {
  if (!t || !key) return fallback;

  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function getCatalogLabels({ group, category, subcategory, t }) {
  if (subcategory && categoryMap[subcategory]) {
    const item = categoryMap[subcategory];

    return {
      groupLabel: translateLabel(t, `category.group.${item.groupKey}`, item.groupLabel),
      categoryLabel: translateLabel(t, `category.main.${item.categoryKey}`, item.categoryLabel),
      subcategoryLabel: translateLabel(t, `categories.sub.${subcategory}`, item.subLabel),
    };
  }

  if (category) {
    const firstMatch = Object.values(categoryMap).find(
      (item) => item.groupKey === group && item.categoryKey === category
    );

    return {
      groupLabel: translateLabel(t, `category.group.${group}`, firstMatch?.groupLabel || prettifyKey(group)),
      categoryLabel: translateLabel(
        t,
        `category.main.${category}`,
        firstMatch?.categoryLabel || prettifyKey(category)
      ),
      subcategoryLabel: "",
    };
  }

  const groupMatch = Object.values(categoryMap).find((item) => item.groupKey === group);

  return {
    groupLabel: translateLabel(t, `category.group.${group}`, groupMatch?.groupLabel || prettifyKey(group)),
    categoryLabel: "",
    subcategoryLabel: "",
  };
}
