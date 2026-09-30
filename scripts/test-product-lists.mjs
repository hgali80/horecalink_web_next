import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function serviceHarness(initial = {}) {
  const rows = new Map(Object.entries(initial));
  const context = vm.createContext({
    db: {}, storage: {},
    collection: (_, name) => name,
    doc: (_, name, id) => ({ name, id }),
    serverTimestamp: () => ({ seconds: 100 }),
    getDocFromServer: async ({ id }) => ({ exists: () => rows.has(id), data: () => rows.get(id) }),
    setDoc: async ({ id }, data) => rows.set(id, { ...rows.get(id), ...data }),
    getDocs: async () => ({ docs: Array.from(rows, ([id, data]) => ({ id, data: () => data })) }),
    onSnapshot: (_, callback) => {
      callback({ docs: Array.from(rows, ([id, data]) => ({ id, data: () => data })) });
      return () => {};
    },
  });
  const source = fs.readFileSync('app/satissitok/services/productListService.js', 'utf8')
    .replace(/^import[\s\S]*?;\r?$/gm, '').replace(/export /g, '');
  vm.runInContext(source, context);
  return { context, rows };
}

test('retrying a new draft saves a single document and preserves creation time', async () => {
  const { context, rows } = serviceHarness();
  const id = await context.createProductList({ storageKey: 'list_draft', title: 'First' });
  rows.get(id).createdAt = { seconds: 20 };
  assert.equal(await context.createProductList({ storageKey: 'list_draft', title: 'Retry' }), id);
  assert.equal(rows.size, 1);
  assert.equal(rows.get(id).title, 'Retry');
  assert.equal(rows.get(id).createdAt.seconds, 20);
});

test('saving a legacy list repairs its missing creation timestamp', async () => {
  const { context, rows } = serviceHarness({ old: { title: 'Legacy' } });
  await context.saveProductList('old', { title: 'Updated' });
  assert.equal(rows.get('old').createdAt.seconds, 100);
});

test('listing includes records without dates and uses authoritative document IDs', async () => {
  const { context } = serviceHarness({ old: { id: 'wrong', title: 'Legacy' }, recent: { updatedAt: { seconds: 120 } }, middle: { createdAt: { seconds: 70 } } });
  const rows = await context.listProductLists();
  assert.deepEqual(Array.from(rows, row => row.id), ['recent', 'middle', 'old']);
  let subscribed;
  const unsubscribe = context.subscribeProductLists(value => { subscribed = value; }, assert.fail);
  assert.equal(subscribed.length, 3);
  assert.equal(typeof unsubscribe, 'function');
});

test('failed server confirmation rejects saving instead of reporting success', async () => {
  const { context } = serviceHarness();
  context.setDoc = async () => {};
  await assert.rejects(context.createProductList({ storageKey: 'not_saved' }), /sunucuda doğrulanamadı/);
});

test('image proxy accepts signed list uploads and rejects unsigned or foreign images', async () => {
  const source = fs.readFileSync('app/api/pdf-image/route.js', 'utf8').replace(/export /g, '');
  const context = vm.createContext({ URL });
  vm.runInContext(source, context);
  const base = 'https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/';
  assert.equal(context.isAllowedImageUrl(new URL(base + 'product_images%2Fphoto.jpg')), true);
  assert.equal(context.isAllowedImageUrl(new URL(base + 'informal_product_list_images%2Flist%2Frow?token=token')), true);
  assert.equal(context.isAllowedImageUrl(new URL(base + 'informal_product_list_images%2Flist%2Frow')), false);
  assert.equal(context.isAllowedImageUrl(new URL('https://example.com/photo.jpg')), false);
});

test('PDF preparation deduplicates images, bounds concurrency and tolerates failed images', async () => {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const context = vm.createContext({
    URL, AbortSignal,
    window: { location: { origin: 'https://horecalink.kz' } },
    FileReader: class {
      readAsDataURL() { this.result = 'data:font/ttf;base64,Zm9udA=='; this.onload(); }
    },
    fetch: async (url) => {
      calls.push(String(url));
      active++; maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return { ok: !String(url).includes('broken'), blob: async () => ({}) };
    },
    createImageBitmap: async () => ({ width: 2000, height: 1000, close() {} }),
    document: { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,aW1hZ2U=' }) },
  });
  const source = fs.readFileSync('app/satissitok/admin/product-lists/productListPdfExport.js', 'utf8')
    .split('// PDF layout')[0].replace(/export /g, '');
  vm.runInContext(source, context);
  const product = 'https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/product_images%2F';
  const items = ['one', 'one', 'two', 'three', 'four', 'five', 'broken', ''].map(name => ({ imageUrl: name ? product + name : '' }));
  const result = await context.prepareProductListPdf({ items }, () => {});
  assert.equal(result.missingImages, 1);
  assert.equal(result.productList.items.length, items.length);
  assert.equal(calls.filter(url => url.includes('one')).length, 1);
  assert.ok(maxActive <= 4);
  assert.equal(result.productList.items[6].pdfImageUrl, '');
  assert.equal(result.productList.items[0].pdfImageUrl, result.productList.items[1].pdfImageUrl);
  assert.equal(items[0].pdfImageUrl, undefined, 'Export must not mutate the editor');
});
