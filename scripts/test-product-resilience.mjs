import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = (path) => fs.readFileSync(path, "utf8")
  .replace(/^\uFEFF/, "")
  .replace(/^import[\s\S]*?;\r?$/gm, "")
  .replace(/export /g, "");

function snapshot(id, data) {
  return { id, exists: true, data: () => data };
}

function createCacheHarness({ products = [], failures = {} } = {}) {
  const calls = { slug: 0, id: 0, related: 0, variants: 0 };
  const remainingFailures = Object.fromEntries(
    Object.entries(failures).map(([key, errors]) => [key, [...errors]])
  );
  const transient = (code) => Object.assign(new Error(`mock ${code}`), { code });

  function keyFor(conditions) {
    if (conditions.some(({ field }) => field === "slug")) return "slug";
    if (conditions.some(({ field }) => field === "productFamilyKey" || field === "sku")) return "variants";
    if (conditions.some(({ field }) => field === "binding_codes" || field === "groupKey")) return "related";
    return "other";
  }

  function failIfConfigured(key) {
    const list = remainingFailures[key];
    if (list?.length) throw transient(list.shift());
  }

  function matches(product, { field, op, value }) {
    const actual = field === "__name__" ? product.id : product[field];
    if (op === "==") return actual === value;
    if (op === "in") return value.includes(actual);
    if (op === "array-contains-any") return Array.isArray(actual) && actual.some((item) => value.includes(item));
    return false;
  }

  const db = {
    collection(name) {
      assert.equal(name, "products");
      return {
        where(field, op, value) {
          const conditions = [{ field, op, value }];
          const query = {
            where(nextField, nextOp, nextValue) {
              conditions.push({ field: nextField, op: nextOp, value: nextValue });
              return query;
            },
            limit() { return query; },
            async get() {
              const key = keyFor(conditions);
              if (key in calls) calls[key] += 1;
              failIfConfigured(key);
              const docs = products.filter((product) => conditions.every((condition) => matches(product, condition)))
                .map((product) => snapshot(product.id, product));
              return { docs, empty: docs.length === 0 };
            },
          };
          return query;
        },
        doc(id) {
          return {
            async get() {
              calls.id += 1;
              failIfConfigured("id");
              const product = products.find((item) => item.id === id);
              return product ? snapshot(product.id, product) : { id, exists: false, data: () => undefined };
            },
          };
        },
      };
    },
  };

  const firestoreSettings = [];
  const cacheContext = vm.createContext({
    console: { error() {} },
    Date,
    Promise,
    setTimeout,
    unstable_cache: (fn) => fn,
    revalidateTag: () => true,
    revalidatePath: () => true,
    PUBLIC_PRODUCTS_CACHE_TAG: "public-products",
    getAdminApp: () => ({ options: { projectId: "mock-project" } }),
    getApps: () => [],
    initializeApp: (_options, name) => ({ name }),
    initializeFirestore: (_app, settings) => { firestoreSettings.push(settings); return db; },
    getFirestore: () => db,
    normalizeProduct: (doc) => ({ id: doc.id, ...doc.data() }),
    getProductFamilyKey: (product) => product.productFamilyKey || "",
    getProductFamilySkus: () => [],
    groupProductFamilies: (items) => items,
    compareProductsByCategoryOrder: () => 0,
    hydrateProductImageNames: (product) => product,
  });
  vm.runInContext(source("app/lib/server/productPageCache.js"), cacheContext);
  return { cacheContext, calls, firestoreSettings };
}

function mockResponse() {
  return {
    json: (body, options = {}) => ({
      body,
      status: options.status ?? 200,
      headers: options.headers ?? {},
    }),
  };
}

function createRouteContext(routeSource, values = {}) {
  const context = vm.createContext({
    console: { error() {} },
    NextResponse: mockResponse(),
    runtime: "nodejs",
    ImportValidationError: class ImportValidationError extends Error {},
    ...values,
  });
  vm.runInContext(source(routeSource), context);
  return context;
}

test("product-page reads retry a transient Firestore failure once with a bounded SDK timeout", async () => {
  const product = { id: "sku-a", slug: "product-a", active: true, webPublished: true };
  const { cacheContext, calls, firestoreSettings } = createCacheHarness({ products: [product], failures: { slug: ["14"] } });
  const result = await cacheContext.getProductPageData("product-a");

  assert.equal(result.product.id, "sku-a");
  assert.equal(calls.slug, 2);
  const retryConfig = firestoreSettings[0].clientConfig.interfaces["google.firestore.v1.Firestore"];
  assert.equal(retryConfig.retry_params.default.total_timeout_millis, 2000);
  assert.equal(retryConfig.methods.RunQuery.timeout_millis, 2000);
  assert.equal(retryConfig.methods.BatchGetDocuments.timeout_millis, 2000);
});

test("not-found, unpublished and permission-denied reads are not retried or converted into cached empty products", async () => {
  const products = [
    { id: "hidden-id", slug: "hidden-product", active: true, webPublished: false },
  ];
  const harness = createCacheHarness({ products });

  assert.equal(await harness.cacheContext.getProductPageData("missing-product"), null);
  assert.equal(await harness.cacheContext.getProductPageData("hidden-id"), null);
  assert.equal(harness.calls.slug, 2);
  assert.equal(harness.calls.id, 2);

  const denied = createCacheHarness({ failures: { slug: ["7"] } });
  await assert.rejects(denied.cacheContext.getProductPageData("denied-product"), { code: "7" });
  assert.equal(denied.calls.slug, 1);
});

test("retry exhaustion preserves the primary product while related products report failure", async () => {
  const product = {
    id: "sku-a", slug: "product-a", active: true, webPublished: true,
    binding_codes: ["related-a"],
  };
  const harness = createCacheHarness({ products: [product], failures: { related: ["unavailable", "unavailable"] } });
  const result = await harness.cacheContext.getProductPageData("product-a");

  assert.equal(result.product.id, "sku-a");
  assert.equal(result.relatedProductsStatus, "rejected");
  assert.deepEqual(Array.from(result.relatedProducts), []);
  assert.equal(harness.calls.related, 2);
});

test("variant-query failure keeps product data and marks the variant list incomplete", async () => {
  const product = {
    id: "sku-a", sku: "sku-a", slug: "product-a", active: true, webPublished: true,
    productFamilyKey: "family-a", binding_codes: [],
  };
  const harness = createCacheHarness({ products: [product], failures: { variants: ["resource-exhausted", "resource-exhausted"] } });
  const result = await harness.cacheContext.getProductPageData("product-a");

  assert.equal(result.product.id, "sku-a");
  assert.equal(result.familyVariantsStatus, "rejected");
  assert.deepEqual(Array.from(result.familyVariants), []);
  assert.equal(harness.calls.variants, 2);
});

test("revalidation endpoint reports success and failure while preserving authorization", async () => {
  let allowed = true;
  let revalidationResult = true;
  let revalidationCalls = 0;
  const route = createRouteContext("app/api/admin/products/revalidate/route.js", {
    authorizeAdminRequest: async () => allowed
      ? { ok: true }
      : { ok: false, response: { status: 401, body: { error: "unauthorized" } } },
    revalidatePublicProductPages: () => { revalidationCalls += 1; return revalidationResult; },
  });
  const request = {};

  let response = await route.POST(request);
  assert.equal(response.status, 200);
  assert.equal(response.body.cacheRevalidated, true);

  revalidationResult = false;
  response = await route.POST(request);
  assert.equal(response.status, 503);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.cacheRevalidated, false);

  allowed = false;
  response = await route.POST(request);
  assert.equal(response.status, 401);
  assert.equal(revalidationCalls, 2);
});

test("successful import stays successful when cache revalidation fails", async () => {
  let importCalls = 0;
  let revalidationCalls = 0;
  const route = createRouteContext("app/api/admin/products/import/route.js", {
    getApps: () => [{}],
    getAuth: () => ({ verifyIdToken: async () => ({ uid: "mock-user" }) }),
    getFirestore: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ role: "admin", isActive: true }) }),
        }),
      }),
    }),
    importProductsFromExcel: async () => { importCalls += 1; return { dryRun: false, totals: { updated: 1 } }; },
    importProductsFromFileBuffer: async () => { throw new Error("unexpected upload path"); },
    DEFAULT_IMPORT_PATH: "mock.xlsx",
    DEFAULT_SHEET_NAME: "Products",
    revalidatePublicProductPages: () => { revalidationCalls += 1; return false; },
  });
  const request = {
    headers: { get: (name) => name === "authorization" ? "Bearer mock-token" : "application/json" },
    json: async () => ({ dryRun: false }),
  };

  const response = await route.POST(request);
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.result.dryRun, false);
  assert.equal(response.body.cacheRevalidated, false);
  assert.match(response.body.warning, /Aynı importu yeniden çalıştırmayın/);
  assert.equal(importCalls, 1);
  assert.equal(revalidationCalls, 1);
});
