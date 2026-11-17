import "server-only";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { normalizeProduct } from "../firestore/products";
import { getProductFamilyKey, getProductFamilySkus, groupProductFamilies } from "../catalog/productFamilies";
import { compareProductsByCategoryOrder } from "../catalog/productSort";
import { hydrateProductImageNames } from "./productImages";
import { getAdminServices } from "./firebaseAdmin";
import { PUBLIC_PRODUCTS_CACHE_TAG } from "./cacheTags";

function chunks(values, size = 30) {
  const unique = [...new Set(values)];
  const result = [];
  for (let index = 0; index < unique.length; index += size) result.push(unique.slice(index, index + size));
  return result;
}

async function getProductBySlug(db, slug) {
  const bySlug = await db.collection("products")
    .where("slug", "==", slug)
    .where("active", "==", true)
    .where("webPublished", "==", true)
    .limit(1)
    .get();
  if (!bySlug.empty) return normalizeProduct(bySlug.docs[0]);

  const byId = await db.collection("products").doc(slug).get();
  if (!byId.exists) return null;
  const data = byId.data();
  return data.active === true && data.webPublished === true ? normalizeProduct(byId) : null;
}

async function getCandidates(db, filters) {
  const snapshots = await Promise.all(filters.map((conditions) => {
    let query = db.collection("products").where("active", "==", true).where("webPublished", "==", true);
    for (const [field, operator, value] of conditions) query = query.where(field, operator, value);
    return query.get();
  }));
  const docs = new Map();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((doc) => docs.set(doc.id, doc)));
  return [...docs.values()].map(normalizeProduct);
}

async function getRelatedProducts(db, product, maxItems = 6) {
  const bindings = Array.isArray(product.binding_codes) ? product.binding_codes : [];
  const family = getProductFamilyKey(product);
  if (!bindings.length && !family) return [];

  const filters = chunks(bindings).map((codes) => [["binding_codes", "array-contains-any", codes]]);
  if (family && product.groupKey && product.categoryKey) {
    filters.push([["groupKey", "==", product.groupKey], ["categoryKey", "==", product.categoryKey]]);
  }
  if (!filters.length) return [];

  const related = await getCandidates(db, filters);
  return groupProductFamilies(related.filter((item) => item.id !== product.id)
    .filter((item) => family ? getProductFamilyKey(item) !== family : true)
    .sort(compareProductsByCategoryOrder)).slice(0, maxItems);
}

async function getProductFamilyVariants(db, product) {
  const family = getProductFamilyKey(product);
  if (!family) return [];
  const skus = getProductFamilySkus(family);
  const filters = [["productFamilyKey", "==", family]];
  for (const group of chunks(skus)) filters.push(["sku", "in", group]);
  const docs = await getCandidates(db, filters.map((filter) => [filter]));
  const found = new Set(docs.map((item) => item.sku).filter(Boolean));
  const legacy = await Promise.all(skus.filter((sku) => !found.has(sku)).map(async (sku) => {
    const doc = await db.collection("products").doc(sku).get();
    if (!doc.exists || doc.data().active !== true || doc.data().webPublished !== true) return null;
    return normalizeProduct(doc);
  }));
  return [...new Map([...docs, ...legacy.filter(Boolean)].map((item) => [item.id, item])).values()]
    .filter((item) => getProductFamilyKey(item) === family)
    .sort((a, b) => (a.dimensions || a.manufacturerCode).localeCompare(
      b.dimensions || b.manufacturerCode, "ru", { numeric: true }));
}

const getCachedProductPageData = unstable_cache(async (slug) => {
  const { adminDb } = getAdminServices();
  const product = await getProductBySlug(adminDb, slug);
  if (!product) return null;
  const hydratedProduct = await hydrateProductImageNames(product);
  const [relatedProducts, familyVariants] = await Promise.all([
    getRelatedProducts(adminDb, hydratedProduct),
    getProductFamilyVariants(adminDb, hydratedProduct),
  ]);
  return { product: hydratedProduct, relatedProducts, familyVariants };
}, ["public-product-page-data-admin-v1"], {
  revalidate: 3600,
  tags: [PUBLIC_PRODUCTS_CACHE_TAG],
});

export function getProductPageData(slug) {
  return getCachedProductPageData(slug);
}

export function revalidatePublicProductPages() {
  try {
    revalidateTag(PUBLIC_PRODUCTS_CACHE_TAG);
    revalidatePath("/sitemap-products.xml");
    revalidatePath("/sitemap-catalog.xml");
    return true;
  } catch (error) {
    console.error("Public product cache revalidation failed", error);
    return false;
  }
}
