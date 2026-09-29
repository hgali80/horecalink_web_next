import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const familyMap = JSON.parse(fs.readFileSync('app/lib/catalog/productFamilyMap.json', 'utf8'));
const source = (path) => fs.readFileSync(path, 'utf8')
  .replace(/^import[\s\S]*?;\r?$/gm, '').replace(/export /g, '');

function harness(rows) {
  const calls = [];
  const documents = rows.map(({ id, ...data }) => ({ id, data: () => data }));
  const context = vm.createContext({
    familyMap, db: {},
    collection: () => 'products',
    documentId: () => '__name__',
    where: (field, op, value) => ({ field, op, value }),
    query: (collection, ...filters) => ({ collection, filters }),
    getDocs: async ({ filters }) => {
      assert.ok(filters.some(f => !['active', 'webPublished'].includes(f.field)), 'No full published-catalog scan');
      for (const filter of filters) {
        if (['in', 'array-contains-any'].includes(filter.op)) {
          assert.ok(filter.value.length > 0 && filter.value.length <= 30, 'Firestore disjunction size');
        }
      }
      const docs = documents.filter(doc => filters.every(({ field, op, value }) => {
        const current = field === '__name__' ? doc.id : doc.data()[field];
        if (op === '==') return current === value;
        if (op === 'in') return value.includes(current);
        if (op === 'array-contains-any') return Array.isArray(current) && current.some(v => value.includes(v));
        throw new Error(`Unexpected operator: ${op}`);
      }));
      calls.push({ filters, count: docs.length });
      return { docs };
    },
  });
  vm.runInContext(source('app/lib/catalog/productSort.js'), context);
  vm.runInContext(source('app/lib/catalog/productFamilies.js'), context);
  vm.runInContext(source('app/lib/firestore/products.js'), context);
  const published = documents.filter(d => d.data().active === true && d.data().webPublished === true)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(context.normalizeProduct);
  return { context, calls, published };
}

function referenceRelated(context, published, product, maxItems = 6) {
  const bindings = context.normalizeArray(product.binding_codes);
  const family = context.getProductFamilyKey(product);
  if (!bindings.length && !family) return [];
  return context.groupProductFamilies(published.filter(item => item.id !== product.id)
    .filter(item => {
      if (family && context.getProductFamilyKey(item) === family) return false;
      return context.normalizeArray(item.binding_codes).some(code => bindings.includes(code)) ||
        (family && item.groupKey === product.groupKey && item.categoryKey === product.categoryKey);
    }).sort(context.sortProducts)).slice(0, maxItems);
}

function referenceVariants(context, published, product) {
  const family = context.getProductFamilyKey(product);
  if (!family) return [];
  return published.filter(item => context.getProductFamilyKey(item) === family)
    .sort((a, b) => (a.dimensions || a.manufacturerCode).localeCompare(
      b.dimensions || b.manufacturerCode, 'ru', { numeric: true }));
}

// Compare complete results, including original URLs, family counts and ordering.
const plain = value => JSON.parse(JSON.stringify(value));
async function checkRows(rows) {
  const { context, calls, published } = harness(rows);
  let oldReturnedRows = 0;
  for (const product of published) {
    assert.deepEqual(plain(await context.getRelatedProducts(product, 6)),
      plain(referenceRelated(context, published, product)), `Related: ${product.id}`);
    assert.deepEqual(plain(await context.getProductFamilyVariants(product)),
      plain(referenceVariants(context, published, product)), `Variants: ${product.id}`);
    const family = context.getProductFamilyKey(product);
    if (family || product.binding_codes.length) oldReturnedRows += published.length;
    if (family) oldReturnedRows += published.length;
  }
  return { products: published.length, queries: calls.length,
    oldReturnedRows, newReturnedRows: calls.reduce((sum, call) => sum + call.count, 0) };
}

test('narrow queries preserve family, binding, visibility, deduplication and sort behavior', async () => {
  const base = { active: true, webPublished: true, groupKey: 'equipment', categoryKey: 'cookers',
    name: 'Same name', dimensions: '10', manufacturerCode: '', binding_codes: [], sortOrder: 1 };
  const rows = Object.entries(familyMap.skus).map(([sku]) => ({ ...base, id: sku, sku, slug: `url-${sku}` }));
  const [firstSku, family] = Object.entries(familyMap.skus)[0];
  rows[0].productFamilyKey = 'OVERRIDE';
  rows.push(
    { ...base, id: 'explicit-new', productFamilyKey: family },
    { ...base, id: 'alternate-id', sku: firstSku },
    { ...base, id: 'inactive', productFamilyKey: family, active: false },
    { ...base, id: 'hidden', productFamilyKey: family, webPublished: false },
    { ...base, id: 'no-relations' },
    { ...base, id: 'bindings', binding_codes: Array.from({ length: 65 }, (_, i) => `B${i}`) },
    { ...base, id: 'bound-cross-category', categoryKey: 'other', binding_codes: ['B64'] },
    { ...base, id: 'unrelated', groupKey: 'other', categoryKey: 'other' },
  );
  // Mapped document ID still works when SKU is missing; explicit overrides win.
  delete rows[1].sku;
  const result = await checkRows(rows);
  assert.ok(result.newReturnedRows < result.oldReturnedRows);
});

test('no family or bindings makes no database request', async () => {
  const { context, calls } = harness([]);
  assert.equal((await context.getRelatedProducts(null)).length, 0);
  assert.equal((await context.getRelatedProducts({ id: 'unmapped' })).length, 0);
  assert.equal((await context.getProductFamilyVariants({ id: 'unmapped' })).length, 0);
  assert.equal(calls.length, 0);
});

test('live published catalog retains identical results (read-only, opt-in)', {
  skip: !process.argv.includes('--live'),
}, async () => {
  require('@next/env').loadEnvConfig(process.cwd());
  const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }) }, 'product-query-verification');
  const db = getFirestore(app);
  try {
    // One read of the published set; all per-product comparisons run in memory.
    const snapshot = await db.collection('products').where('active', '==', true)
      .where('webPublished', '==', true).get();
    const result = await checkRows(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    console.log('In-memory query-result comparison (not billed CPU):', JSON.stringify(result));
    assert.ok(result.newReturnedRows < result.oldReturnedRows);
  } finally {
    await db.terminate();
    await deleteApp(app);
  }
});
