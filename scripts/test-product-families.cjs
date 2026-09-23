const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const familyMap = require('../app/lib/catalog/productFamilyMap.json');
const source = fs.readFileSync(require.resolve('../app/lib/catalog/productFamilies.js'), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/export /g, '');
const context = vm.createContext({ familyMap });
vm.runInContext(source, context);
const products = Object.entries(familyMap.skus).map(([sku, key]) => ({
  id: sku, sku, slug: `original-${sku}`, manufacturerCode: key,
}));
const cards = context.groupProductFamilies(products);
assert.equal(products.length, 511);
assert.equal(cards.length, 78);
assert.equal(cards.find(p => p.familyKey === 'CE-TC0').familyVariantCount, 26);
assert.equal(cards.find(p => p.familyKey === 'CE-TBC').familyVariantCount, 4);
assert.equal(cards.find(p => p.familyKey === 'CE-IR').familyVariantCount, 66);
assert.equal(cards.filter(p => p.familyKey.startsWith('CE-AGN')).length, 2);
assert.equal(new Set(cards.map(p => p.familyKey)).size, 78);
assert.equal(context.getProductFamilyKey({ sku: '308266', productFamilyKey: 'NEW-SERIES' }), 'NEW-SERIES');
const independent = { id: 'unmapped', slug: 'keep-me', name: 'Independent' };
assert.equal(context.groupProductFamilies([independent])[0], independent);
const match = products.find(p => p.sku === '308266');
assert.equal(context.groupProductFamilies([match])[0].slug, match.slug);
assert.equal(context.groupProductFamilies([{ id: '311559' }]).length, 0);
assert.equal(products.some(p => p.familyCard), false, 'Do not mutate SKU records / SEO data');
assert.equal(context.groupProductFamilies([{id:'new',productFamilyKey:'CE-TC0'},products.find(p => p.sku === '308127')])[0].familyVariantCount, 2);
console.log('Product families: 511 SKUs -> 78 cards; counts, explicit overrides, original URLs, new variants, exclusions and non-mutation verified.');
