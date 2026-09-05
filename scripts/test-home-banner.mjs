import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../app/lib/homeBanner.js', import.meta.url), 'utf8');
const { validateBannerSettings, validateBannerFile, validateBannerDimensions, BANNER_MAX_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
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
// Regression: the user's 2162 × 727 PNG previously failed both strict limits.
assert.doesNotThrow(() => validateBannerFile({ type: 'image/png', size: 2338245 }));
assert.doesNotThrow(() => validateBannerDimensions(2162, 727));
assert.doesNotThrow(() => validateBannerFile({ type: 'image/webp', size: BANNER_MAX_BYTES }));
assert.throws(() => validateBannerFile({ type: 'image/jpeg', size: BANNER_MAX_BYTES + 1 }), /10 MB/);
assert.throws(() => validateBannerFile({ type: 'image/gif', size: 100 }), /format/);
assert.throws(() => validateBannerFile({ type: 'image/png', size: 0 }), /boş/);
for (const width of [2700, 3000, 3300]) assert.doesNotThrow(() => validateBannerDimensions(width, 1000));
for (const [width, height] of [[2699, 1000], [3301, 1000], [1000, 1000], [1000, 3000], [1500, 0], [15000, 5000]])
  assert.throws(() => validateBannerDimensions(width, height));
console.log('Upload checks passed: user image, 10 MB boundary, ratio tolerance and invalid files.');
