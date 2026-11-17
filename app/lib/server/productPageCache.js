import "server-only";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, initializeFirestore } from "firebase-admin/firestore";
import { normalizeProduct } from "../firestore/products";
import { getProductFamilyKey, getProductFamilySkus, groupProductFamilies } from "../catalog/productFamilies";
import { compareProductsByCategoryOrder } from "../catalog/productSort";
import { hydrateProductImageNames } from "./productImages";
import { getAdminApp } from "./firebaseAdmin";
import { PUBLIC_PRODUCTS_CACHE_TAG } from "./cacheTags";

const PRODUCT_PAGE_DB_APP_NAME = "horecalink-public-product-page-reads";
const PRODUCT_READ_MAX_ATTEMPTS = 2;
const PRODUCT_READ_RETRY_DELAY_MS = 100;
const PRODUCT_READ_TOTAL_WAIT_MS = 4100;
const FIRESTORE_READ_RPC_TIMEOUT_MS = 2000;
const FIRESTORE_READ_RETRY_CODES = "deadline_exceeded_resource_exhausted_internal_unavailable";

const PRODUCT_PAGE_FIRESTORE_SETTINGS = {
  clientConfig: {
    interfaces: {
      "google.firestore.v1.Firestore": {
        retry_params: {
          default: {
            initial_retry_delay_millis: 100,
            retry_delay_multiplier: 1.3,
            max_retry_delay_millis: 250,
            initial_rpc_timeout_millis: FIRESTORE_READ_RPC_TIMEOUT_MS,
            rpc_timeout_multiplier: 1,
            max_rpc_timeout_millis: FIRESTORE_READ_RPC_TIMEOUT_MS,
            total_timeout_millis: FIRESTORE_READ_RPC_TIMEOUT_MS,
          },
        },
        methods: {
          GetDocument: {
            timeout_millis: FIRESTORE_READ_RPC_TIMEOUT_MS,
            retry_codes_name: FIRESTORE_READ_RETRY_CODES,
            retry_params_name: "default",
          },
          BatchGetDocuments: {
            timeout_millis: FIRESTORE_READ_RPC_TIMEOUT_MS,
            retry_codes_name: FIRESTORE_READ_RETRY_CODES,
            retry_params_name: "default",
          },
          RunQuery: {
            timeout_millis: FIRESTORE_READ_RPC_TIMEOUT_MS,
            retry_codes_name: FIRESTORE_READ_RETRY_CODES,
            retry_params_name: "default",
          },
        },
      },
    },
  },
};

const TRANSIENT_FIRESTORE_CODES = new Set([
  "4", "8", "13", "14",
  "deadline-exceeded", "resource-exhausted", "internal", "unavailable",
]);

let productPageDb;

function getProductPageFirestore() {
  if (productPageDb) return productPageDb;

  const adminApp = getAdminApp();
  let productPageApp = getApps().find((app) => app.name === PRODUCT_PAGE_DB_APP_NAME);
  if (productPageApp) {
    productPageDb = getFirestore(productPageApp);
    return productPageDb;
  }

  productPageApp = initializeApp(adminApp.options, PRODUCT_PAGE_DB_APP_NAME);
  productPageDb = initializeFirestore(productPageApp, PRODUCT_PAGE_FIRESTORE_SETTINGS);
  return productPageDb;
}

function isTransientFirestoreError(error) {
  return TRANSIENT_FIRESTORE_CODES.has(String(error?.code ?? "").toLowerCase());
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runProductRead(operation) {
  const startedAt = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= PRODUCT_READ_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const elapsed = Date.now() - startedAt;
      if (
        !isTransientFirestoreError(error) ||
        attempt === PRODUCT_READ_MAX_ATTEMPTS ||
        elapsed + PRODUCT_READ_RETRY_DELAY_MS + FIRESTORE_READ_RPC_TIMEOUT_MS > PRODUCT_READ_TOTAL_WAIT_MS
      ) {
        throw error;
      }
      await wait(PRODUCT_READ_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

function chunks(values, size = 30) {
  const unique = [...new Set(values)];
  const result = [];
  for (let index = 0; index < unique.length; index += size) result.push(unique.slice(index, index + size));
  return result;
}

async function getProductBySlug(db, slug) {
  const bySlug = await runProductRead(() => db.collection("products")
    .where("slug", "==", slug)
    .where("active", "==", true)
    .where("webPublished", "==", true)
    .limit(1)
    .get());
  if (!bySlug.empty) return normalizeProduct(bySlug.docs[0]);

  const byId = await runProductRead(() => db.collection("products").doc(slug).get());
  if (!byId.exists) return null;
  const data = byId.data();
  return data.active === true && data.webPublished === true ? normalizeProduct(byId) : null;
}

async function getCandidates(db, filters) {
  const snapshots = await Promise.all(filters.map((conditions) => {
    let query = db.collection("products").where("active", "==", true).where("webPublished", "==", true);
    for (const [field, operator, value] of conditions) query = query.where(field, operator, value);
    return runProductRead(() => query.get());
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
    const doc = await runProductRead(() => db.collection("products").doc(sku).get());
    if (!doc.exists || doc.data().active !== true || doc.data().webPublished !== true) return null;
    return normalizeProduct(doc);
  }));
  return [...new Map([...docs, ...legacy.filter(Boolean)].map((item) => [item.id, item])).values()]
    .filter((item) => getProductFamilyKey(item) === family)
    .sort((a, b) => (a.dimensions || a.manufacturerCode).localeCompare(
      b.dimensions || b.manufacturerCode, "ru", { numeric: true }));
}

const productCacheOptions = {
  revalidate: 3600,
  tags: [PUBLIC_PRODUCTS_CACHE_TAG],
};

const getCachedProduct = unstable_cache(async (slug) => {
  return getProductBySlug(getProductPageFirestore(), slug);
}, ["public-product-record-admin-v2"], productCacheOptions);

const getCachedRelatedProducts = unstable_cache(async (product) => {
  return getRelatedProducts(getProductPageFirestore(), product);
}, ["public-product-related-admin-v2"], productCacheOptions);

const getCachedFamilyVariants = unstable_cache(async (product) => {
  return getProductFamilyVariants(getProductPageFirestore(), product);
}, ["public-product-variants-admin-v2"], productCacheOptions);

export async function getProductPageData(slug) {
  const product = await getCachedProduct(slug);
  if (!product) return null;

  const hydratedProduct = hydrateProductImageNames(product);
  const [relatedResult, variantsResult] = await Promise.allSettled([
    getCachedRelatedProducts(hydratedProduct),
    getCachedFamilyVariants(hydratedProduct),
  ]);

  if (relatedResult.status === "rejected") {
    console.error("Related product read failed:", relatedResult.reason);
  }
  if (variantsResult.status === "rejected") {
    console.error("Product family variant read failed:", variantsResult.reason);
  }

  return {
    product: hydratedProduct,
    relatedProducts: relatedResult.status === "fulfilled" ? relatedResult.value : [],
    relatedProductsStatus: relatedResult.status,
    familyVariants: variantsResult.status === "fulfilled" ? variantsResult.value : [],
    familyVariantsStatus: variantsResult.status,
  };
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
