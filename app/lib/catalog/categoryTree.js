// app/lib/catalog/categoryTree.js

import { categoryMap } from "../../data/categoryMap";

function sortByLabel(a, b) {
  return String(a.label || "").localeCompare(String(b.label || ""), "tr");
}

export function buildCatalogTree() {
  const groups = {};

  Object.entries(categoryMap).forEach(([subcategoryKey, item]) => {
    const groupKey = item.groupKey;
    const categoryKey = item.categoryKey;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        key: groupKey,
        label: item.groupLabel,
        categories: {},
      };
    }

    if (!groups[groupKey].categories[categoryKey]) {
      groups[groupKey].categories[categoryKey] = {
        key: categoryKey,
        label: item.categoryLabel,
        subcategories: [],
      };
    }

    groups[groupKey].categories[categoryKey].subcategories.push({
      key: subcategoryKey,
      label: item.subLabel,
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