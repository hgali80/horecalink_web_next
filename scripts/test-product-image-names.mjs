import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { buildProductImageIndex, getStoredProductImageNames, getProductImageStems,
  mergeDiscoveredProductImageNames } from '../app/lib/productImageNames.mjs';

const require = createRequire(import.meta.url);

function referenceDiscovery(product, filenames) {
  const found = getProductImageStems(product).flatMap(stem => {
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}(?:-(\\d+))?\\.[a-z0-9]+$`, 'i');
    return filenames.filter(name => name.startsWith(stem) && pattern.test(name))
      .sort((a, b) => Number(a.match(pattern)[1] || 0) - Number(b.match(pattern)[1] || 0));
  });
  return [...new Set([...getStoredProductImageNames(product), ...found])];
}

test('stored images keep order, extensions and imageBase fallback without I/O', () => {
  assert.deepEqual(getStoredProductImageNames({ image_names: [' cover ', 'cover.jpg', 'B.PNG', 'null'] }), ['cover.jpg', 'B.PNG']);
  assert.deepEqual(getStoredProductImageNames({ image_names: [], imageBase: 'A;B.webp' }), ['A.jpg', 'B.webp']);
  assert.deepEqual(getStoredProductImageNames({}), []);
  const source = fs.readFileSync('app/lib/server/productImages.js', 'utf8')
    .replace(/^import.*;\r?$/gm, '').replace(/export /g, '');
  const context = vm.createContext({ getStoredProductImageNames });
  vm.runInContext(source, context);
  assert.equal(context.hydrateProductImageNames(null), null);
  const product = { id: 'A', image_names: ['A'] };
  const hydrated = context.hydrateProductImageNames(product);
  assert.deepEqual(hydrated.image_names, ['A.jpg']);
  assert.deepEqual(product.image_names, ['A'], 'No mutation of the source product');
});

test('inventory matches legacy discovery, avoiding prefix collisions and preserving numeric order', () => {
  const filenames = ['12.jpg', '12-1.jpg', '12-2.PNG', '12-10.jpg', '123.jpg',
    '12-other.jpg', '12/sub.jpg', 'SKU.jpg', 'sku-1.jpg', 'a+b.jpg', 'a+b-1.webp', '12-2-1.jpg'].sort();
  const index = buildProductImageIndex(filenames);
  for (const product of [{ id: '12' }, { id: '12-2' }, { id: 'a+b' },
    { id: '12', sku: 'SKU', image_names: ['manual.webp', '12.jpg'] }]) {
    assert.deepEqual(mergeDiscoveredProductImageNames(product, index), referenceDiscovery(product, filenames));
  }
  assert.deepEqual(mergeDiscoveredProductImageNames({ id: '12' }, index), ['12.jpg', '12-1.jpg', '12-2.PNG', '12-10.jpg']);
  const product = { id: '12', image_names: ['manual.webp'] };
  const once = mergeDiscoveredProductImageNames(product, index);
  assert.deepEqual(mergeDiscoveredProductImageNames({ ...product, image_names: once }, index), once, 'Maintenance is idempotent');
});

test('Excel import discovers images once and refuses writes when inventory fails', async () => {
  const xlsx = require('xlsx');
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
    [], [], [], ['id', 'image_names', 'name'], [], ['A', 'A.jpg', 'Product A'], ['B', 'B.jpg', 'Product B'],
  ]), 'Urun_Sablonu');
  workbook.Sheets.Urun_Sablonu['!ref'] = 'A1:C7';
  let inventoryLoads = 0;
  let writes = [];
  let failInventory = false;
  const adminDb = {
    collection: () => ({ get: async () => ({ docs: [] }), doc: id => id }),
    bulkWriter: () => ({ set: (id, data) => writes.push({ id, data }),
      delete: () => assert.fail('Unexpected delete'), close: async () => {} }),
  };
  const context = vm.createContext({
    fs, path, xlsx, process,
    FieldValue: { serverTimestamp: () => 'timestamp' },
    mergeDiscoveredProductImageNames,
    loadProductImageIndex: async () => {
      inventoryLoads++;
      if (failInventory) throw new Error('Storage unavailable');
      return buildProductImageIndex(['A.jpg', 'A-1.jpg', 'B.jpg', 'B-2.webp']);
    },
  });
  const source = fs.readFileSync('app/lib/server/productImport.js', 'utf8')
    .replace(/^\uFEFF/, '').replace(/^import.*;\r?$/gm, '')
    .replace(/^export \{.*\};\r?$/gm, '').replace(/export /g, '');
  vm.runInContext(source, context);
  await context.importProductsFromWorkbook({ adminDb, workbook, sourceLabel: 'test', dryRun: false });
  assert.equal(inventoryLoads, 1);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.find(item => item.id === 'A').data.image_names, ['A.jpg', 'A-1.jpg']);
  assert.deepEqual(writes.find(item => item.id === 'B').data.image_names, ['B.jpg', 'B-2.webp']);
  writes = [];
  failInventory = true;
  await assert.rejects(context.importProductsFromWorkbook({ adminDb, workbook, sourceLabel: 'test', dryRun: false }), /Storage unavailable/);
  assert.equal(writes.length, 0);
});

test('live inventory exactly preserves prior discovery for every product (read-only, opt-in)', {
  skip: !process.argv.includes('--live'),
}, async () => {
  require('@next/env').loadEnvConfig(process.cwd());
  const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getStorage } = require('firebase-admin/storage');
  const app = initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }), storageBucket: process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'horecakatalog-e2d10.firebasestorage.app' }, 'image-inventory-test');
  const db = getFirestore(app);
  try {
    const [snapshot, [files]] = await Promise.all([
      db.collection('products').get(), getStorage(app).bucket().getFiles({ prefix: 'product_images/' }),
    ]);
    const filenames = files.map(file => file.name.slice('product_images/'.length)).sort();
    const index = buildProductImageIndex(filenames);
    for (const doc of snapshot.docs) {
      const product = { ...doc.data(), id: doc.id };
      assert.deepEqual(mergeDiscoveredProductImageNames(product, index), referenceDiscovery(product, filenames), doc.id);
    }
    console.log(`Verified old/new image discovery: ${snapshot.size} products, ${files.length} Storage objects.`);
  } finally {
    await db.terminate();
    await deleteApp(app);
  }
});
