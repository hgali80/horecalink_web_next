import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../app/lib/homeBanner.js', import.meta.url), 'utf8');
const { validateBannerSettings } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const valid = () => ({ autoplay: true, interval: 5, revision: 0, slides: [
  { id: 'one', alt: 'First', href: '/products' }, { id: 'two', alt: 'Second', href: 'https://example.com/sale' },
] });
assert.doesNotThrow(() => validateBannerSettings(valid()));
for (const count of [0, 1, 6]) {
  const settings = valid(); settings.slides = Array.from({ length: count }, (_, i) => ({ id: `id-${i}`, alt: 'Image', href: '' }));
  assert.throws(() => validateBannerSettings(settings), /2.*5/);
}
for (const count of [2, 5]) {
  const settings = valid(); settings.slides = Array.from({ length: count }, (_, i) => ({ id: `id-${i}`, alt: 'Image', href: '' }));
  assert.doesNotThrow(() => validateBannerSettings(settings));
}
for (const interval of [0, 1, 61, 2.5, '5', NaN]) assert.throws(() => validateBannerSettings({ ...valid(), interval }));
for (const href of ['javascript:alert(1)', 'data:text/html,bad', '//example.com', '/\\example.com', 'ftp://example.com', 'https://example.com/a\nb']) {
  const settings = valid(); settings.slides[0].href = href; assert.throws(() => validateBannerSettings(settings));
}
const duplicate = valid(); duplicate.slides[1].id = 'one'; assert.throws(() => validateBannerSettings(duplicate));
const emptyAlt = valid(); emptyAlt.slides[0].alt = ' '; assert.throws(() => validateBannerSettings(emptyAlt));
console.log('Banner validation checks passed: counts, timing, duplicate IDs, descriptions and unsafe URLs.');
