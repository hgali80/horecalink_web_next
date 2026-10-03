import test from 'node:test';
import assert from 'node:assert/strict';
import { MetaCatalog } from '../app/lib/server/metaCatalog.mjs';
import { buildWhatsAppPayload } from '../app/lib/server/whatsappProductPayload.mjs';

const product = { id: '102385', sku: '102385', name: 'Тестовый товар', specs: 'Нержавеющая сталь', price: 4000, brand: 'Test', image_names: ['102385.jpg'], stockTracked: true };
test('KZT minor units, Russian text, order availability and encoded canonical URL', () => {
  const payload = buildWhatsAppPayload({ ...product, slug: 'товар тест', dimensions: '10x20' });
  assert.equal(payload.price, 400000); assert.equal(payload.currency, 'KZT');
  assert.equal(payload.retailer_id, '102385'); assert.equal(payload.availability, 'available for order');
  assert.match(payload.description, /Размеры: 10x20/); assert.match(payload.url, /%D1%82/);
  assert.equal(buildWhatsAppPayload(product).availability, 'available for order');
  assert.equal(buildWhatsAppPayload({ ...product, stockTracked: false }).availability, 'available for order');
});
test('stock fields never affect catalog content and inventory is never sent', () => {
  const variants = [
    { stockTracked: true, stock: 0, rQty: 0, fQty: 0, availability: 'out of stock' },
    { stockTracked: true, stock: 100, rQty: 100, fQty: -10, availability: 'in stock' },
    { stockTracked: false, stock: -1 },
  ].map(fields => buildWhatsAppPayload({ ...product, ...fields }));
  variants.forEach(value => {
    assert.equal(value.availability, 'available for order');
    assert.equal(Object.hasOwn(value, 'inventory'), false);
    assert.equal(Object.hasOwn(value, 'quantity_to_sell_on_facebook'), false);
    assert.deepEqual(value, variants[0]);
  });
});
test('all distinct web images up to one main and 20 extras, preserving order', () => {
  const images = Array.from({ length: 25 }, (_, i) => `102385-${i}.jpg`);
  const payload = buildWhatsAppPayload({ ...product, image_names: [images[0], ...images] });
  assert.equal(payload.additional_image_urls.length, 20);
  assert.match(payload.image_url, /102385-0.jpg/); assert.match(payload.additional_image_urls[19], /102385-20.jpg/);
  assert.deepEqual(buildWhatsAppPayload(product).additional_image_urls, []);
});
test('reject incomplete items instead of uploading invalid catalog records', () => {
  for (const patch of [{ sku: '' }, { name: '' }, { brand: '' }, { specs: '' }, { price: 0 }, { price: NaN }, { image_names: [] }]) {
    assert.throws(() => buildWhatsAppPayload({ ...product, ...patch }));
  }
});
function api(responses) {
  const calls = [];
  const client = new MetaCatalog({ token: 'test-secret', fetchImpl: async (url, options) => {
    calls.push({ url, ...options });
    const body = responses.shift();
    return { ok: !body.error, status: body.error ? 400 : 200, json: async () => body };
  } });
  return { client, calls };
}
test('CREATE resolves SKU, uses v26.0 and sends secrets only in authorization header', async () => {
  const { client, calls } = api([{ data: [] }, { id: 'meta-1' }]);
  assert.deepEqual(await client.sync('102385', buildWhatsAppPayload(product)), { id: 'meta-1', action: 'CREATE' });
  assert.match(calls[0].url, /v26\.0\/1610542617193791\/products/);
  assert.match(decodeURIComponent(calls[0].url), /"retailer_id":\{"eq":"102385"\}/);
  assert.equal(calls[1].headers.Authorization, 'Bearer test-secret'); assert.ok(!calls[1].url.includes('test-secret'));
});
test('existing SKU UPDATE clears removed extra images; DELETE is idempotent', async () => {
  const update = api([{ data: [{ id: 'meta-1' }] }, { success: true }]);
  assert.equal((await update.client.sync('102385', buildWhatsAppPayload(product))).action, 'UPDATE');
  assert.deepEqual(JSON.parse(update.calls[1].body).additional_image_urls, []);
  const remove = api([{ data: [{ id: 'meta-1' }] }, { success: true }]);
  await remove.client.sync('102385', null); assert.equal(remove.calls[1].method, 'DELETE');
  const absent = api([{ data: [] }]); await absent.client.sync('102385', null); assert.equal(absent.calls.length, 1);
});
test('duplicate remote SKU fails; upstream secret-bearing error text is redacted', async () => {
  await assert.rejects(api([{ data: [{ id: '1' }, { id: '2' }] }]).client.sync('102385', null), /birden fazla/);
  await assert.rejects(api([{ error: { code: 190, message: 'test-secret' } }]).client.sync('102385', null), error => !error.message.includes('test-secret') && error.message.includes('190'));
});
