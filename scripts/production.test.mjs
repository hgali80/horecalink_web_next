import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function quoteHarness() {
  const writes = [];
  const source = fs.readFileSync('app/services/quoteService.js', 'utf8')
    .replace(/import\s+[\s\S]*?from\s+"[^"]+";\s*/g, '')
    .replace(/export\s+/g, '');
  const context = vm.createContext({
    db: {}, collection: (_db, path) => path,
    serverTimestamp: () => 'timestamp',
    addDoc: async (path, payload) => { writes.push({ path, payload }); return { id: 'test-request' }; },
  });
  vm.runInContext(source, context);
  return { create: context.createQuoteRequest, writes };
}

test('production requests retain group, technical notes and customer without inventing inventory lines', async () => {
  for (const group of ['stainless', 'packaging']) {
    const { create, writes } = quoteHarness();
    const result = await create({ user: { uid: 'test-user' }, items: [], production: { group, family: 'custom', language: 'tr' }, form: { fullName: 'Test User', phone: '+70000000000', note: 'Thickness: 40 microns\nQuantity: 500 kg' } });
    assert.equal(result.id, 'test-request');
    assert.equal(writes.length, 1);
    const { path, payload } = writes[0];
    assert.equal(path, 'quote_requests');
    assert.equal(payload.requestMeta.source, 'web_production_form');
    assert.equal(payload.requestMeta.productionGroup, group);
    assert.equal(payload.customer.fullName, 'Test User');
    assert.equal(payload.note, 'Thickness: 40 microns\nQuantity: 500 kg');
    assert.equal(payload.items.length, 0);
    assert.equal(payload.pricing.listAmount, null);
  }
});

test('empty ordinary requests and invalid production groups still cannot be submitted', async () => {
  const { create, writes } = quoteHarness();
  for (const production of [undefined, { group: 'unknown', family: 'x' }, { group: 'packaging', family: '' }]) {
    await assert.rejects(create({ items: [], form: {}, production }), /ITEMS_REQUIRED/);
  }
  assert.equal(writes.length, 0);
});

test('normal catalog quote quantities and prices keep existing behavior', async () => {
  const { create, writes } = quoteHarness();
  await create({ user: { uid: 'test-user' }, form: {}, items: [{ id: 'sku1', quantity: 3, price: 250 }] });
  assert.equal(writes[0].payload.requestMeta.source, 'web_quote_form');
  assert.equal(writes[0].payload.pricing.listAmount, 750);
  assert.equal(writes[0].payload.itemCount, 1);
});

test('production labels do not spread to traded equipment or unrelated institutional goods', () => {
  const source = fs.readFileSync('app/lib/production.js', 'utf8').replace(/export\s+/g, '');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(context.getProductionGroup({ groupKey: 'equipment' }), null);
  assert.equal(context.getProductionGroup({ groupKey: 'institutional', subcategoryKey: 'soap' }), null);
  assert.equal(context.getProductionGroup({ groupKey: 'paslanmaz' }), 'stainless');
  assert.equal(context.getProductionGroup({ subcategoryKey: 'cop-torbasi-ve-posetler' }), 'packaging');
  assert.equal(context.getProductionGroup({ groupKey: 'paslanmaz', productionGroup: 'none' }), null);
});

test('all four languages cover the same production content', () => {
  const source = fs.readFileSync('app/lib/production.js', 'utf8').replace(/export\s+/g, '');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const expected = Object.keys(context.getProductionCopy('tr')).sort();
  for (const lang of ['tr', 'ru', 'kz', 'en']) {
    const content = context.getProductionCopy(lang);
    assert.deepEqual(Object.keys(content).sort(), expected);
    for (const value of Object.values(content)) assert.ok(Array.isArray(value) ? value.every(Boolean) : Boolean(value));
  }
});
