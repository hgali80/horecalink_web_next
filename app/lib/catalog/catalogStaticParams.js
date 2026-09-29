import { categoryData } from "../../data/categoryData.js";

export function getCatalogGroupStaticParams() {
  return Object.keys(categoryData).map((group) => ({ group }));
}

export function getCatalogCategoryStaticParams() {
  return Object.entries(categoryData).flatMap(([group, groupData]) =>
    Object.keys(groupData.mainCategories).map((category) => ({
      group,
      category,
    }))
  );
}

export function getCatalogSubcategoryStaticParams() {
  return Object.entries(categoryData).flatMap(([group, groupData]) =>
    Object.entries(groupData.mainCategories).flatMap(
      ([category, subcategories]) =>
        subcategories.map((subcategory) => ({
          group,
          category,
          subcategory,
        }))
    )
  );
}
