// app/lib/catalog/categoryTree.js

import { categoryMap } from "../../data/categoryMap";
import {
  getGroupLabel,
  getMainCategoryLabel,
  getSubcategoryLabel,
} from "./catalogLabels";

function sortByLabel(a, b) {
  return String(a.label || "").localeCompare(String(b.label || ""), "tr");
}

export function buildCatalogTree({ t, lang }) {
  const groups = {};

  Object.entries(categoryMap).forEach(([subcategoryKey, item]) => {
    const groupKey = item.groupKey;
    const categoryKey = item.categoryKey;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        key: groupKey,
        label: getGroupLabel({ t, lang, groupKey, fallback: item.groupLabel }),
        categories: {},
      };
    }

    if (!groups[groupKey].categories[categoryKey]) {
      groups[groupKey].categories[categoryKey] = {
        key: categoryKey,
        label: getMainCategoryLabel({ t, lang, categoryKey, fallback: item.categoryLabel }),
        subcategories: [],
      };
    }

    groups[groupKey].categories[categoryKey].subcategories.push({
      key: subcategoryKey,
      label: getSubcategoryLabel({ t, lang, subcategoryKey, fallback: item.subLabel }),
    });
  });

  return Object.values(groups)
    .map((group) => ({
      ...group,
      categories: Object.values(group.categories)
        .map((category) => ({
          ...category,
          subcategories: [...category.subcategories].sort(sortByLabel),
        }))
        .sort(sortByLabel),
    }))
    .sort(sortByLabel);
}
