import familyMap from "./productFamilyMap.json";

const text = (value) => String(value ?? "").trim();
const familySkus = new Map();
for (const [sku, family] of Object.entries(familyMap.skus)) {
  if (!familySkus.has(family)) familySkus.set(family, []);
  familySkus.get(family).push(sku);
}

export function getProductFamilySkus(family) {
  return [...(familySkus.get(text(family)) || [])];
}

export function getProductFamilyKey(product) {
  return text(product?.productFamilyKey) || familyMap.skus[text(product?.sku || product?.id)] || "";
}

export function getProductFamilyTitle(product) {
  const key = getProductFamilyKey(product);
  return text(product?.productFamilyTitle) || familyMap.titles[key] || key;
}

// Group after filtering, before pagination. Keep the matching variant's URL/SKU.
export function groupProductFamilies(products) {
  const cards = new Map();
  for (const product of products) {
    if (["311559", "327627", "316202"].includes(text(product.sku || product.id))) continue;
    const family = getProductFamilyKey(product);
    const key = family ? `family:${family}` : `product:${product.id}`;
    if (!cards.has(key)) {
      cards.set(key, family ? { ...product, familyCard: true, familyKey: family,
        familyTitle: getProductFamilyTitle(product), familyVariantCount: 1 } : product);
    } else if (family) cards.get(key).familyVariantCount += 1;
  }
  return [...cards.values()];
}
