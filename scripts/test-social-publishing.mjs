import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDraft, canClaim, DEFAULT_SETTINGS, almatyToUtc, productFacts } from '../app/lib/socialPublishing.mjs';
import { buildWhatsAppPayload } from '../app/lib/server/whatsappProductPayload.mjs';
import { publishSocial, metaRequest } from '../app/lib/server/socialMeta.mjs';

const now = Date.parse('2026-10-30T12:00:00Z');
const draft = { productId: 'p1', channels: ['instagram', 'facebook'], scheduledAt: new Date(now + 60000).toISOString(), media: {}, captions: { instagram: 'Ürün' } };
test('rejects invalid dates, duplicate channels, path IDs and missing custom assets', () => {
  for (const body of [{ ...draft, scheduledAt: 'invalid' }, { ...draft, channels: ['instagram', 'instagram'] }, { ...draft, productId: '../x' }, { ...draft, media: { instagram: { source: 'custom' } } }]) assert.throws(() => normalizeDraft(body, now));
  assert.equal(normalizeDraft(draft, now).media.facebook.source, 'web');
});
test('Almaty calendar input becomes the correct UTC instant', () => {
  assert.equal(almatyToUtc('2026-10-30T17:00'), '2026-10-30T12:00:00.000Z');
  assert.throws(() => almatyToUtc('invalid'));
});
test('paused, future, stale, cancelled and already claimed jobs cannot publish', () => {
  const post = { status: 'scheduled', revision: 2, approvedRevision: 2, contentHash: 'a', approvedHash: 'a' };
  const job = { status: 'queued', revision: 2, nextAttemptAt: now };
  assert.equal(canClaim(post, job, { paused: false }, now), true);
  assert.equal(canClaim(post, job, DEFAULT_SETTINGS, now), false);
  for (const changed of [{ ...job, nextAttemptAt: now + 1 }, { ...job, revision: 1 }, { ...job, status: 'publishing' }]) assert.equal(canClaim(post, changed, { paused: false }, now), false);
  for (const changed of [{ ...post, approvedHash: 'b' }, { ...post, status: 'cancelled' }, { ...post, approvedRevision: 1 }]) assert.equal(canClaim(changed, job, { paused: false }, now), false);
});
test('product facts change for price, technical specification and active state', () => {
  const p = { name: 'A', sku: 'sku', price: 10, active: true };
  for (const change of [{ price: 12 }, { specs: 'new' }, { active: false }]) assert.notDeepEqual(productFacts(p, 'p1'), productFacts({ ...p, ...change }, 'p1'));
});
test('WhatsApp custom images are separate from existing web images', () => {
  const product = { sku: 'sku', name_ru: 'Товар', price: 10, brand: 'B', specs: 'S', image_names: ['web.jpg'] };
  assert.match(buildWhatsAppPayload(product).image_url, /web.jpg/);
  assert.match(buildWhatsAppPayload({ ...product, whatsapp_image_names: ['custom.jpg'] }).image_url, /custom.jpg/);
  assert.match(buildWhatsAppPayload({ ...product, whatsapp_image_names: ['../bad'] }).image_url, /web.jpg/);
});
test('Instagram container is persisted before publication and reused on the next run', async () => {
  const previousFetch = global.fetch;
  const previous = { token: process.env.META_SOCIAL_ACCESS_TOKEN, id: process.env.META_SOCIAL_INSTAGRAM_ID };
  process.env.META_SOCIAL_ACCESS_TOKEN = 'test-token'; process.env.META_SOCIAL_INSTAGRAM_ID = '123';
  const calls = []; let saved;
  global.fetch = async (url, options) => { calls.push({ url: String(url), method: options.method }); return { ok: true, json: async () => calls.length === 1 ? { id: '456' } : calls.length === 2 ? { status_code: 'FINISHED' } : { id: '789' } }; };
  try {
    assert.equal((await publishSocial({ channel: 'instagram' }, 'caption', 'https://example.com/image.jpg', async id => { saved = id; })).status, 'queued');
    assert.equal(saved, '456'); assert.equal(calls.length, 1);
    assert.equal((await publishSocial({ channel: 'instagram', containerId: saved }, 'caption', 'image', async () => assert.fail())).remoteId, '789');
    assert.equal(calls.filter(call => call.url.endsWith('/media')).length, 1);
    assert.equal(calls.filter(call => call.url.endsWith('/media_publish')).length, 1);
  } finally { global.fetch = previousFetch; if (previous.token === undefined) delete process.env.META_SOCIAL_ACCESS_TOKEN; else process.env.META_SOCIAL_ACCESS_TOKEN = previous.token; if (previous.id === undefined) delete process.env.META_SOCIAL_INSTAGRAM_ID; else process.env.META_SOCIAL_INSTAGRAM_ID = previous.id; }
});
test('upstream errors reveal only a numeric code and ambiguous POST is not retried', async () => {
  const original = global.fetch; let calls = 0;
  try {
    global.fetch = async () => { calls++; return { ok: false, status: 400, json: async () => ({ error: { code: 190, message: 'secret token or upstream body' } }) }; };
    await assert.rejects(metaRequest('123/photos', { method: 'POST', token: 'test-token' }), { message: 'META_190' });
    assert.equal(calls, 1);
    global.fetch = async () => { calls++; throw new Error('network failure'); };
    await assert.rejects(metaRequest('123/photos', { method: 'POST', token: 'test-token' }));
    assert.equal(calls, 2);
  } finally { global.fetch = original; }
});
