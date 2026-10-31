import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSocialProducts, socialProductLabel } from '../app/lib/socialProductSearch.mjs';
const products = [
  { id: '1', sku: '102385', name_ru: 'КАСТРЮЛЯ С КРЫШКОЙ', name_tr: 'Çelik Tencere', brand: 'Öztiryakiler' },
  { id: '2', sku: '100107', name_ru: 'РУКОЯТКА СИНЯЯ', name_tr: 'Mavi Sap' },
];
test('empty query lists the entire catalog; SKU and Russian name are case insensitive', () => {
  assert.equal(filterSocialProducts(products, '').length, 2);
  assert.equal(filterSocialProducts(products, '  кастрюля  ')[0].id, '1');
  assert.equal(filterSocialProducts(products, '2385')[0].id, '1');
});
test('Turkish accents/case and combined SKU-name queries match', () => {
  for (const query of ['CELIK', 'çelİk', '1023 tencere', 'oztiryakiler']) assert.equal(filterSocialProducts(products, query)[0].id, '1');
  assert.equal(filterSocialProducts(products, '102385 mavi').length, 0);
  assert.equal(filterSocialProducts(products, 'olmayan').length, 0);
});
test('filtering reaches products after the previous 50-row limit', () => {
  const catalog = [...Array.from({ length: 70 }, (_, i) => ({ id: `p${i}`, sku: `p${i}` })), ...products];
  assert.equal(filterSocialProducts(catalog, 'tencere')[0].sku, '102385');
  assert.equal(socialProductLabel(products[0]), '102385 · КАСТРЮЛЯ С КРЫШКОЙ');
});
