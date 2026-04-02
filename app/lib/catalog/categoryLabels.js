// app/lib/catalog/categoryLabels.js

import { categoryMap } from "../../data/categoryMap";
import {
  getGroupLabel,
  getMainCategoryLabel,
  getSubcategoryLabel,
} from "./catalogLabels";

function prettifyKey(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getCatalogLabels({ group, category, subcategory, t, lang }) {
  if (subcategory && categoryMap[subcategory]) {
    const item = categoryMap[subcategory];

    return {
      groupLabel: getGroupLabel({ t, lang, groupKey: item.groupKey, fallback: item.groupLabel }),
      categoryLabel: getMainCategoryLabel({
        t,
        lang,
        categoryKey: item.categoryKey,
        fallback: item.categoryLabel,
      }),
      subcategoryLabel: getSubcategoryLabel({
        t,
        lang,
        subcategoryKey: subcategory,
        fallback: item.subLabel,
      }),
    };
  }

  if (category) {
    const firstMatch = Object.values(categoryMap).find(
      (item) => item.groupKey === group && item.categoryKey === category
    );

    return {
      groupLabel: getGroupLabel({
        t,
        lang,
        groupKey: group,
        fallback: firstMatch?.groupLabel || prettifyKey(group),
      }),
      categoryLabel: getMainCategoryLabel({
        t,
        lang,
        categoryKey: category,
        fallback: firstMatch?.categoryLabel || prettifyKey(category),
      }),
      subcategoryLabel: "",
    };
  }

  const groupMatch = Object.values(categoryMap).find((item) => item.groupKey === group);

  return {
    groupLabel: getGroupLabel({
      t,
      lang,
      groupKey: group,
      fallback: groupMatch?.groupLabel || prettifyKey(group),
    }),
    categoryLabel: "",
    subcategoryLabel: "",
  };
}
