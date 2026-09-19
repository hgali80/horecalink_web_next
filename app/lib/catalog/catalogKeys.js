import { catalogKeyAliases } from "../../data/catalogKeyAliases.js";

export function canonicalCatalogKey(scope, value) {
  const key = String(value || "").trim();
  return catalogKeyAliases[scope]?.[key] || key;
}

// Existing translated labels and uploaded images retain their original keys.
export function legacyCatalogKey(scope, value) {
  return Object.entries(catalogKeyAliases[scope] || {})
    .find(([, canonical]) => canonical === value)?.[0] || value;
}

export function normalizeCatalogPath({ group, category, subcategory }) {
  return {
    group: canonicalCatalogKey("group", group),
    category: canonicalCatalogKey("main", category),
    subcategory: canonicalCatalogKey("sub", subcategory),
  };
}
