// app/lib/catalog/categoryLabels.js

import { categoryMap } from "../../data/categoryMap";

function prettifyKey(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getCatalogLabels({ group, category, subcategory }) {
  if (subcategory && categoryMap[subcategory]) {
    const item = categoryMap[subcategory];

    return {
      groupLabel: item.groupLabel,
      categoryLabel: item.categoryLabel,
      subcategoryLabel: item.subLabel,
    };
  }

  if (category) {
    const firstMatch = Object.values(categoryMap).find(
      (item) => item.groupKey === group && item.categoryKey === category
    );

    return {
      groupLabel: firstMatch?.groupLabel || prettifyKey(group),
      categoryLabel: firstMatch?.categoryLabel || prettifyKey(category),
      subcategoryLabel: "",
    };
  }

  const groupMatch = Object.values(categoryMap).find(
    (item) => item.groupKey === group
  );

  return {
    groupLabel: groupMatch?.groupLabel || prettifyKey(group),
    categoryLabel: "",
    subcategoryLabel: "",
  };
}