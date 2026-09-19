import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { categoryMap } from '../app/data/categoryMap.js';
import { categoryData } from '../app/data/categoryData.js';
import { catalogKeyAliases } from '../app/data/catalogKeyAliases.js';
import { canonicalCatalogKey, legacyCatalogKey, normalizeCatalogPath } from '../app/lib/catalog/catalogKeys.js';
import { categoryTranslationOverrides } from '../app/lib/catalog/catalogTranslationOverrides.js';

function labelsHarness() {
  const source = fs.readFileSync('app/lib/catalog/catalogLabels.js', 'utf8')
    .replace(/import\s+[\s\S]*?from\s+"[^"]+";\s*/g, '').replace(/export\s+/g, '');
  const context = vm.createContext({ categoryMap, categoryTranslationOverrides, canonicalCatalogKey, legacyCatalogKey });
  vm.runInContext(source, context);
  return context;
}

test('old catalog URLs resolve to the imported Firebase keys', () => {
  assert.deepEqual(normalizeCatalogPath({ group: 'paslanmaz', category: 'tezgahlar', subcategory: 'duz-tezgahlar' }), {
    group: 'stainless-steel', category: 'worktables', subcategory: 'plain-worktables',
  });
  for (const [oldKey, newKey] of Object.entries(catalogKeyAliases.sub)) {
    assert.ok(categoryMap[newKey], oldKey);
    assert.equal(canonicalCatalogKey('sub', oldKey), newKey);
    assert.equal(canonicalCatalogKey('sub', newKey), newKey);
  }
});

test('navigation tree agrees with all canonical subcategories', () => {
  for (const [sub, item] of Object.entries(categoryMap)) {
    assert.ok(categoryData[item.groupKey].mainCategories[item.categoryKey].includes(sub));
  }
  assert.deepEqual(Object.keys(categoryData).sort(), ['equipment', 'institutional', 'stainless-steel']);
});

test('product classification prefers new keys over legacy display fields', () => {
  const labels = labelsHarness();
  for (const [sub, item] of Object.entries(categoryMap)) {
    const resolved = labels.resolveProductCategoryKeys({ groupKey: item.groupKey, categoryKey: item.categoryKey, subcategoryKey: sub, subcategory: 'tuvalet-kagitlari' });
    assert.equal(resolved.groupKey, item.groupKey);
    assert.equal(resolved.categoryKey, item.categoryKey);
    assert.equal(resolved.subcategoryKey, sub);
  }
  assert.equal(labels.normalizeCatalogGroupKey('paslanmaz'), 'stainless-steel');
  assert.equal(labels.normalizeCatalogGroupKey('stainless-steel'), 'stainless-steel');
});

test('renamed categories retain translated labels and image storage keys', () => {
  const labels = labelsHarness();
  for (const lang of ['tr', 'ru', 'kz', 'en']) {
    const locale = JSON.parse(fs.readFileSync(`app/locales/${lang}.json`, 'utf8'));
    const t = key => locale[key] || key;
    for (const [oldKey, newKey] of Object.entries(catalogKeyAliases.sub)) {
      assert.equal(labels.getSubcategoryLabel({t, lang, subcategoryKey: newKey}), labels.getSubcategoryLabel({t, lang, subcategoryKey: oldKey}));
    }
  }
  assert.equal(`${legacyCatalogKey('group', 'stainless-steel')}--${legacyCatalogKey('main', 'worktables')}`, 'paslanmaz--tezgahlar');
});

test('Firestore catalog queries use canonical keys and retain publication guards', async () => {
  let constraints;
  const source = fs.readFileSync('app/lib/firestore/products.js', 'utf8')
    .replace(/import\s+[\s\S]*?from\s+"[^"]+";\s*/g, '').replace(/export\s+/g, '');
  const context = vm.createContext({ canonicalCatalogKey, db: {}, collection: () => 'products',
    where: (field, op, value) => ({ field, op, value }),
    query: (_, ...filters) => { constraints = filters; return filters; },
    getDocs: async () => ({ docs: [] }),
  });
  vm.runInContext(source, context);
  await context.getCatalogProducts({ groupKey: 'paslanmaz', categoryKey: 'tezgahlar', subcategoryKey: 'duz-tezgahlar' });
  assert.deepEqual(Object.fromEntries(constraints.map(({field, value}) => [field, value])), {
    groupKey: 'stainless-steel', categoryKey: 'worktables', subcategoryKey: 'plain-worktables', active: true, webPublished: true,
  });
});
