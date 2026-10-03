import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildWhatsAppPayload } from '../app/lib/server/whatsappProductPayload.mjs';

const source = (await readFile(new URL('../app/lib/server/whatsappCatalog.js', import.meta.url), 'utf8'))
  .replace("import 'server-only';", '')
  .replace("import { FieldValue } from 'firebase-admin/firestore';", 'const FieldValue = { serverTimestamp: () => 123 };')
  .replace("import { MetaCatalog } from './metaCatalog.mjs';", 'const MetaCatalog = class { sync(...args) { return globalThis.__waTest.sync(...args); } };')
  .replace("import { buildWhatsAppPayload } from './whatsappProductPayload.mjs';", 'const buildWhatsAppPayload = (...args) => globalThis.__waTest.payload(...args);')
  .replace("import { getBaseUrl } from './siteConfig';", "const getBaseUrl = () => 'https://horecalink.kz';");
const { syncWhatsAppProduct, reconcileWhatsAppCatalog } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const product = { sku: '102385', name: 'Товар', specs: 'Сталь', brand: 'Test', price: 4000, image_names: ['102385.jpg'], whatsappPublished: true };
class DB {
  constructor(records = {}) { this.records = new Map(Object.entries(records)); this.queue = Promise.resolve(); }
  collection(name) {
    if (name === 'erp_stock_balances') throw new Error('WhatsApp must never read ERP inventory');
    const records = this.records;
    const query = (field, value, limit = Infinity) => ({
      limit: count => query(field, value, count),
      get: async () => ({ docs: [...records].filter(([key, data]) => key.startsWith(name + '/') && (!field || data[field] === value)).slice(0, limit).map(([key, data]) => ({ id: key.split('/')[1], data: () => structuredClone(data) })) }),
    });
    return { ...query(), where: (field, op, value) => { assert.equal(op, '=='); return query(field, value); }, doc: id => {
      const key = `${name}/${id}`;
      return { get: async () => { const data = structuredClone(records.get(key)); return { exists: data !== undefined, data: () => data }; },
        set: async (data, options) => { records.set(key, options?.merge ? { ...records.get(key), ...data } : data); },
      };
    } };
  }
  async runTransaction(fn) {
    const run = this.queue.then(async () => fn({ get: ref => ref.get(), set: (ref, data, options) => ref.set(data, options) }));
    this.queue = run.catch(() => {}); return run;
  }
}
function setup(records = {}, sync = async (sku, payload) => ({ id: payload ? 'meta-1' : null, action: payload ? 'UPDATE' : 'DELETE' })) {
  const calls = [];
  globalThis.__waTest = { payload: buildWhatsAppPayload, sync: async (...args) => { calls.push(args); return sync(...args); } };
  return { db: new DB(records), calls };
}
test('persist desired publication and confirmed status; offline Web does not suppress WhatsApp', async () => {
  const { db, calls } = setup({ 'products/102385': { ...product, webPublished: false }, 'erp_stock_balances/102385': { rQty: 3 } });
  const result = await syncWhatsAppProduct(db, '102385');
  assert.equal(result.status, 'synced'); assert.equal(calls[0][1].availability, 'available for order');
  assert.equal(db.records.get('products/102385').webPublished, false);
  assert.equal(db.records.get('whatsapp_catalog_sync/102385').leaseUntil, 0);
});
test('remote failure preserves retry SKU and preference; later retry succeeds', async () => {
  const { db } = setup({ 'products/102385': product }, async () => { throw new Error('raw secret test-token'); });
  await assert.rejects(syncWhatsAppProduct(db, '102385'), /başarısız/);
  const state = db.records.get('whatsapp_catalog_sync/102385');
  assert.equal(state.sku, '102385'); assert.equal(state.status, 'error'); assert.ok(!state.lastError.includes('test-token'));
  assert.equal(db.records.get('products/102385').whatsappPublished, true);
  globalThis.__waTest.sync = async () => ({ id: 'meta-1', action: 'UPDATE' });
  assert.equal((await syncWhatsAppProduct(db, '102385')).status, 'synced');
});
test('deletion survives product removal using persisted SKU; unpublished records DELETE', async () => {
  const deleted = setup({ 'whatsapp_catalog_sync/102385': { sku: '102385', status: 'pending' } });
  await syncWhatsAppProduct(deleted.db, '102385'); assert.deepEqual(deleted.calls[0], ['102385', null]);
  const unpublished = setup({ 'products/102385': { ...product, whatsappPublished: false } });
  assert.equal((await syncWhatsAppProduct(unpublished.db, '102385')).status, 'removed');
});
test('active lease blocks concurrent worker without clearing original lease', async () => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const { db } = setup({ 'products/102385': product }, async () => { started(); await gate; return { id: 'meta-1', action: 'UPDATE' }; });
  const first = syncWhatsAppProduct(db, '102385'); await ready;
  const owner = db.records.get('whatsapp_catalog_sync/102385').owner;
  await assert.rejects(syncWhatsAppProduct(db, '102385'), /sürüyor/);
  assert.equal(db.records.get('whatsapp_catalog_sync/102385').owner, owner);
  release(); await first;
});
test('product changed during remote request remains pending rather than falsely synced', async () => {
  const { db } = setup({ 'products/102385': product }, async () => { db.records.set('products/102385', { ...product, whatsappPublished: false }); return { id: 'meta-1', action: 'UPDATE' }; });
  const result = await syncWhatsAppProduct(db, '102385');
  assert.equal(result.status, 'pending'); assert.equal(result.published, false);
});
test('duplicate local SKU blocks remote mutation', async () => {
  const { db, calls } = setup({ 'products/102385': product, 'products/other': product });
  await assert.rejects(syncWhatsAppProduct(db, '102385'), /SKU başka/); assert.equal(calls.length, 0);
});
test('reconciliation pages progress and retry an error without starving later items', async () => {
  const records = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`products/sku${i}`, { ...product, sku: `sku${i}` }]));
  const { db } = setup(records);
  const first = await reconcileWhatsAppCatalog(db); assert.equal(first.results.length, 5); assert.equal(first.nextCursor, 'sku4');
  const second = await reconcileWhatsAppCatalog(db, first.nextCursor); assert.equal(second.results.length, 2); assert.equal(second.nextCursor, null);
});

test('SKU migration failure retains old SKU for cleanup on retry', async () => {
  const { db } = setup({ 'products/102385': product, 'whatsapp_catalog_sync/102385': { sku: 'old-sku', status: 'synced' } }, async () => { throw new Error('Meta Catalog failed'); });
  await assert.rejects(syncWhatsAppProduct(db, '102385'));
  assert.equal(db.records.get('whatsapp_catalog_sync/102385').obsoleteSku, 'old-sku');
  const calls = [];
  globalThis.__waTest.sync = async (sku, payload) => { calls.push([sku, payload]); return { id: payload ? 'meta-1' : null, action: payload ? 'UPDATE' : 'DELETE' }; };
  await syncWhatsAppProduct(db, '102385');
  assert.deepEqual(calls[0], ['old-sku', null]);
  assert.equal(calls[1][0], '102385'); assert.equal(db.records.get('whatsapp_catalog_sync/102385').obsoleteSku, null);
});
