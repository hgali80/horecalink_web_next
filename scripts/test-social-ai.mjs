import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { aiOptions, aiFacts, aiCacheKey, aiRequest, parseAiResponse, requestAiCaptions, AI_MODEL } from '../app/lib/server/socialAiCore.mjs';

const source = (await readFile(new URL('../app/lib/server/socialAi.js', import.meta.url), 'utf8')).replace("import 'server-only';", '')
  .replace("from './socialAiCore.mjs'", `from '${new URL('../app/lib/server/socialAiCore.mjs', import.meta.url).href}'`)
  .replace("from '../socialPublishing.mjs'", `from '${new URL('../app/lib/socialPublishing.mjs', import.meta.url).href}'`);
const { generateSocialCaptions } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
class DB {
  constructor(records = {}) { this.records = new Map(Object.entries(records)); this.queue = Promise.resolve(); }
  collection(name) { return { doc: id => ({ key: `${name}/${id}`, get: async () => { const data = this.records.get(`${name}/${id}`); return { exists: data !== undefined, data: () => structuredClone(data) }; } }) }; }
  runTransaction(fn) {
    const run = this.queue.then(async () => { const writes = []; let writing = false; const result = await fn({ get: ref => { assert.equal(writing, false); return ref.get(); }, set: (ref, data) => { writing = true; writes.push(() => this.records.set(ref.key, structuredClone(data))); } }); writes.forEach(write => write()); return result; });
    this.queue = run.catch(() => {}); return run;
  }
}
const now = Date.parse('2026-10-31T12:00:00Z');
const product = { active: true, webPublished: true, name_ru: 'Товар', sku: '123', price: 2500, specs: 'Steel', secret: 'do-not-send' };
const body = { productId: 'p', displayName: 'Özel ürün adı', language: 'tr', includePrice: false };
const generated = { captions: { instagram: 'Instagram #HorecaLink', facebook: 'Facebook #HorecaLink' }, usage: { inputTokens: 100, outputTokens: 200 } };
function setup(extraEnv = {}, generate = async () => generated) {
  const db = new DB({ 'products/p': product }); let calls = 0;
  return { db, calls: () => calls, dependencies: { env: { OPENAI_API_KEY: 'test-key', ...extraEnv }, now, generate: async (...args) => { calls++; return generate(...args); } } };
}
test('same product/settings reuse a durable cached response without a second paid request', async () => {
  const { db, calls, dependencies } = setup();
  assert.equal((await generateSocialCaptions(db, body, 'user', dependencies)).cached, false);
  assert.equal((await generateSocialCaptions(db, body, 'another-user', dependencies)).cached, true);
  assert.equal(calls(), 1);
  assert.equal(db.records.get('social_ai_usage/global_2026-10-31').count, 1);
  assert.equal(db.records.get('products/p').name_ru, 'Товар');
});
test('concurrent identical requests reserve at most one paid call', async () => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const { db, calls, dependencies } = setup({}, async () => { started(); await gate; return generated; });
  const first = generateSocialCaptions(db, body, 'user', dependencies); await ready;
  await assert.rejects(generateSocialCaptions(db, body, 'other', dependencies), /hazırlanıyor/);
  release(); await first; assert.equal(calls(), 1);
});
test('daily cap stops new requests while cached outputs remain free', async () => {
  const { db, calls, dependencies } = setup({ SOCIAL_AI_DAILY_LIMIT: '1' });
  await generateSocialCaptions(db, body, 'user', dependencies);
  await assert.rejects(generateSocialCaptions(db, { ...body, language: 'ru' }, 'user', dependencies), /Günlük/);
  assert.equal((await generateSocialCaptions(db, body, 'user', dependencies)).cached, true); assert.equal(calls(), 1);
});
test('failed requests count toward budget and never retry automatically', async () => {
  const { db, calls, dependencies } = setup({}, async () => { throw new Error('raw secret-bearing error'); });
  await assert.rejects(generateSocialCaptions(db, body, 'user', dependencies), /otomatik tekrar denenmedi/);
  assert.equal(calls(), 1); assert.equal(db.records.get('social_ai_usage/global_2026-10-31').count, 1);
});
test('facts are bounded, exclude unrelated fields and price unless explicitly requested', () => {
  const options = aiOptions(body), facts = aiFacts({ ...product, specs: 'x'.repeat(10000) }, 'p', options);
  assert.equal(facts.name, body.displayName); assert.equal(facts.description.length, 800); assert.equal(facts.priceKzt, null); assert.equal('secret' in facts, false);
  assert.equal(aiFacts(product, 'p', { ...options, includePrice: true }).priceKzt, 2500);
  const key = aiCacheKey(facts, options, AI_MODEL);
  for (const [data, prefs] of [[{ ...facts, name: 'New name' }, options], [facts, { ...options, language: 'ru' }], [{ ...facts, description: 'New specs' }, options]]) assert.notEqual(aiCacheKey(data, prefs, AI_MODEL), key);
  assert.throws(() => aiOptions({ ...body, language: 'invalid' }));
});
test('one bounded structured API request produces two editable channel drafts', async () => {
  const options = aiOptions(body), facts = aiFacts(product, 'p', options), request = aiRequest(facts, options, AI_MODEL);
  assert.equal(request.store, false); assert.equal(request.max_output_tokens, 1400); assert.equal(request.text.format.strict, true);
  assert.equal('tools' in request, false); assert.ok(request.input.length < 2200);
  let calls = 0;
  const result = await requestAiCaptions(facts, options, AI_MODEL, 'secret', async (url, init) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(init.headers.Authorization, 'Bearer secret');
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ instagram: { caption: 'A', hashtags: ['#HorecaLink', '#Mutfak'] }, facebook: { caption: 'B', hashtags: ['#HorecaLink'] } }) }] }] }) };
  });
  assert.equal(calls, 1); assert.match(result.captions.instagram, /#Mutfak/);
  assert.throws(() => parseAiResponse({ status: 'incomplete' }), /tamamlanamadı/);
});
