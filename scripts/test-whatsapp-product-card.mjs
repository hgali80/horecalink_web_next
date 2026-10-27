import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cardFacts, cardOptions, factsRevision, cardSvg } from '../app/lib/server/whatsappProductCardCore.mjs';
import { validateReply } from '../app/lib/server/whatsappReplyCore.mjs';

const require = createRequire(import.meta.url), sharp = require('sharp');
const options = { productId: 'item-1', language: 'ru', showPrice: false };
const product = { active: true, webPublished: true, name_ru: 'Стол из нержавеющей стали', name_kk: 'Тот баспайтын болат үстел', sku: 'HL-100', brand: 'HorecaLink', specs: 'Размеры: 1200 × 600 × 850 мм\nМатериал: нержавеющая сталь\nРабочая поверхность с бортом', price: 125000, image_names: ['HL-100.jpg'], slug: 'steel-table' };
const coreUrl = new URL('../app/lib/server/whatsappProductCardCore.mjs', import.meta.url).href;
const now = Date.now(), conversationId = 'a'.repeat(64);
const body = { action: 'send', text: 'Информация о товаре', reviewed: true, reviewedRecipient: '77001234567', baseIncomingAt: now, baseRevision: String(now), requestId: '11111111-1111-4111-8111-111111111111', shareMode: 'image', ...options, productRevision: factsRevision(cardFacts(options.productId, product, options)), cardRevision: 'c'.repeat(64) };

test('cards use published verified facts, hide price by default and escape product markup', () => {
  const facts = cardFacts('item-1', product, options);
  assert.equal(facts.price, null); assert.equal(facts.showPrice, false);
  assert.equal(cardFacts('item-1', product, { ...options, showPrice: true }).price, 125000);
  assert.throws(() => cardFacts('item-1', { ...product, active: false }, options));
  assert.throws(() => cardFacts('item-1', { ...product, image_names: ['../secret.jpg'] }, options));
  for (const language of ['invalid', 'toString', '__proto__']) assert.throws(() => cardOptions({ ...options, language }));
  assert.notEqual(factsRevision(facts), factsRevision(cardFacts('item-1', { ...product, price: 130000 }, { ...options, showPrice: true })));
  assert.match(cardSvg({ ...facts, name: '<script>& hello' }, 'data:image/jpeg;base64,eA=='), /&lt;script&gt;&amp;/);
  assert.doesNotMatch(cardSvg(facts, 'data:image/jpeg;base64,eA=='), /125.?000/);
});
test('image sends require preview revisions, review and bounded captions', () => {
  assert.equal(validateReply(body), body);
  for (const change of [{ reviewed: false }, { productRevision: '' }, { cardRevision: '' }, { text: 'я'.repeat(1025) }, { showPrice: undefined }, { shareMode: 'remote-url' }]) assert.throws(() => validateReply({ ...body, ...change }));
});

test('actual renderer produces deterministic JPEGs, rejects redirects/foreign hosts and bounds input', async () => {
  let code = await readFile(new URL('../app/lib/server/whatsappProductCard.js', import.meta.url), 'utf8');
  code = code.replace("import 'server-only';", '').replace("'sharp'", JSON.stringify(new URL('../node_modules/sharp/lib/index.js', import.meta.url).href)).replace("'./whatsappProductCardCore.mjs'", JSON.stringify(coreUrl));
  const { renderProductCard } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const original = globalThis.fetch;
  try {
    const photo = await sharp({ create: { width: 900, height: 500, channels: 3, background: '#dbe3e8' } }).composite([{ input: Buffer.from('<svg width="900" height="500"><rect x="100" y="140" width="700" height="55" rx="8" fill="#a4adb5"/><path d="M150 195V410M750 195V410" stroke="#7f8d99" stroke-width="24"/><path d="M150 335H750" stroke="#99a5af" stroke-width="15"/></svg>') }]).jpeg().toBuffer();
    globalThis.fetch = async (url, init) => { assert.equal(init.redirect, 'error'); assert.match(String(url), /^https:\/\/firebasestorage.googleapis.com/); return new Response(photo, { headers: { 'Content-Type': 'image/jpeg' } }); };
    const facts = cardFacts('item-1', product, { ...options, showPrice: true });
    const card = await renderProductCard(facts), again = await renderProductCard(facts);
    assert.equal(card.cardRevision, again.cardRevision);
    const metadata = await sharp(card.buffer).metadata();
    assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1240);
    if (process.env.CRM_CARD_REVIEW_PATH) await writeFile(process.env.CRM_CARD_REVIEW_PATH, card.buffer);
    await assert.rejects(renderProductCard({ ...facts, imageUrl: 'https://evil.invalid/picture.jpg' }));
    globalThis.fetch = async () => new Response('x', { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '6000000' } });
    await assert.rejects(renderProductCard(facts), { status: 413 });
    globalThis.fetch = async () => new Response('x', { headers: { 'Content-Type': 'text/html' } });
    await assert.rejects(renderProductCard(facts), { status: 502 });
  } finally { globalThis.fetch = original; }
});

function database() {
  const records = new Map([[`whatsapp_conversations/${conversationId}`, { senderId: '77001234567', phoneNumberId: '200', lastIncomingAt: new Date(now) }], ['products/item-1', product]]);
  const doc = path => ({ path, get: async () => ({ exists: records.has(path), data: () => records.get(path) }), collection: name => collection(`${path}/${name}`) });
  const collection = path => ({ doc: id => doc(`${path}/${id}`) });
  let tail = Promise.resolve();
  return { records, collection, runTransaction: callback => {
    const work = tail.then(async () => { let writing = false; const writes = [];
      const result = await callback({ get: async ref => { assert.equal(writing, false); return ref.get(); }, set: (ref, value) => { writing = true; writes.push(() => records.set(ref.path, value)); }, create: (ref, value) => { writing = true; assert.ok(!records.has(ref.path)); writes.push(() => records.set(ref.path, value)); }, update: (ref, value) => { writing = true; writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...value })); } });
      writes.forEach(write => write()); return result;
    }); tail = work.catch(() => {}); return work;
  } };
}

let routeCode = await readFile(new URL('../app/api/admin/whatsapp/conversations/[conversationId]/reply/route.js', import.meta.url), 'utf8');
const rendererStub = `data:text/javascript;base64,${Buffer.from('export const renderProductCard = async facts => ({buffer: Buffer.from("jpeg"), cardRevision: globalThis.__cardRevision || "c".repeat(64)});').toString('base64')}`;
routeCode = routeCode.replace("import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';", 'const authorizeWhatsAppRequest = async () => globalThis.__cardAuth; const inboxJson = (body,status=200) => Response.json(body,{status});')
  .replaceAll("'@/app/lib/server/whatsappInboxCore.mjs'", JSON.stringify(new URL('../app/lib/server/whatsappInboxCore.mjs', import.meta.url).href))
  .replaceAll("'@/app/lib/server/whatsappReplyCore.mjs'", JSON.stringify(new URL('../app/lib/server/whatsappReplyCore.mjs', import.meta.url).href))
  .replaceAll("'@/app/lib/server/whatsappProductCardCore.mjs'", JSON.stringify(coreUrl))
  .replaceAll("'@/app/lib/server/whatsappDeliveryCore.mjs'", JSON.stringify(new URL('../app/lib/server/whatsappDeliveryCore.mjs', import.meta.url).href))
  .replaceAll("'@/app/lib/server/whatsappProductCard'", JSON.stringify(rendererStub));
const route = await import(`data:text/javascript;base64,${Buffer.from(routeCode).toString('base64')}`);

test('actual image send uploads once, uses canonical recipient, stores review and never repeats a timeout', async () => {
  const savedFetch = globalThis.fetch, keys = ['WHATSAPP_SEND_ENABLED', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_GRAPH_API_VERSION'], saved = keys.map(key => [key, process.env[key]]);
  const context = { params: Promise.resolve({ conversationId }) }, request = value => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(value) });
  try {
    Object.assign(process.env, { WHATSAPP_SEND_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'fake', WHATSAPP_PHONE_NUMBER_ID: '200', WHATSAPP_GRAPH_API_VERSION: 'v26.0' });
    const db = database(); globalThis.__cardAuth = { ok: true, uid: 'admin', adminDb: db };
    let uploads = 0, sends = 0;
    globalThis.fetch = async (url, init) => {
      if (url.endsWith('/media')) { uploads++; assert.equal(init.body.get('messaging_product'), 'whatsapp'); assert.equal(init.body.get('file').type, 'image/jpeg'); return Response.json({ id: '12345' }); }
      sends++; const payload = JSON.parse(init.body); assert.equal(payload.type, 'image'); assert.equal(payload.to, '77001234567'); assert.equal(payload.image.id, '12345'); assert.equal(payload.image.caption, body.text); return Response.json({ messages: [{ id: 'wamid.image' }] });
    };
    const results = await Promise.all([route.POST(request(body), context), route.POST(request(body), context)]);
    assert.ok(results.every(result => result.status === 200)); assert.equal(uploads, 1); assert.equal(sends, 1);
    assert.equal([...db.records.values()].find(value => value.sendState === 'accepted').productCard.name, product.name_ru);
    assert.equal((await route.POST(request({ ...body, cardRevision: 'd'.repeat(64) }), context)).status, 409);
    // A stale product is rejected before upload or durable send claim.
    const stale = database(); stale.records.set('products/item-1', { ...product, name_ru: 'Changed name' }); globalThis.__cardAuth.adminDb = stale;
    assert.equal((await route.POST(request(body), context)).status, 409); assert.equal(uploads, 1);
    const unknown = database(); globalThis.__cardAuth.adminDb = unknown;
    globalThis.fetch = async url => { if (url.endsWith('/media')) { uploads++; return Response.json({ id: '12345' }); } sends++; throw new Error('timeout'); };
    assert.equal((await (await route.POST(request(body), context)).json()).state, 'unknown');
    assert.equal((await (await route.POST(request(body), context)).json()).state, 'unknown'); assert.equal(uploads, 2); assert.equal(sends, 2);
    assert.ok(unknown.records.get(`whatsapp_conversations/${conversationId}`).pendingSendId);
    // A changed photograph fails before either provider request, and releases the claim safely.
    const changed = database(); globalThis.__cardAuth.adminDb = changed; globalThis.__cardRevision = 'd'.repeat(64);
    assert.equal((await (await route.POST(request(body), context)).json()).state, 'rejected'); assert.equal(uploads, 2); assert.equal(sends, 2);
    assert.equal(changed.records.get(`whatsapp_conversations/${conversationId}`).pendingSendId, null);
    delete globalThis.__cardRevision;
    // A definite upload rejection never calls /messages and never leaks provider details.
    const uploadFailed = database(); globalThis.__cardAuth.adminDb = uploadFailed;
    globalThis.fetch = async url => { assert.ok(url.endsWith('/media')); uploads++; return Response.json({ error: { message: 'SECRET' } }, { status: 403 }); };
    const failed = await (await route.POST(request(body), context)).json();
    assert.equal(failed.state, 'rejected'); assert.doesNotMatch(JSON.stringify(failed), /SECRET/); assert.equal(sends, 2);
    assert.equal(uploadFailed.records.get(`whatsapp_conversations/${conversationId}`).pendingSendId, null);
    // A customer message arriving while upload runs requires a fresh human review.
    const newMessage = database(); globalThis.__cardAuth.adminDb = newMessage;
    globalThis.fetch = async url => { assert.ok(url.endsWith('/media')); newMessage.records.get(`whatsapp_conversations/${conversationId}`).lastIncomingRevision = 'new-revision'; return Response.json({ id: '12345' }); };
    assert.equal((await (await route.POST(request(body), context)).json()).state, 'rejected'); assert.equal(sends, 2);
  } finally { globalThis.fetch = savedFetch; delete globalThis.__cardAuth; delete globalThis.__cardRevision; for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('actual preview route rejects unauthorized requests, checks product visibility and enforces quota', async () => {
  let code = await readFile(new URL('../app/api/admin/whatsapp/products/card/route.js', import.meta.url), 'utf8');
  code = code.replace("import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';", 'const authorizeWhatsAppRequest = async () => globalThis.__previewAuth; const inboxJson = (body,status=200) => Response.json(body,{status});')
    .replace("'@/app/lib/server/whatsappInboxCore.mjs'", JSON.stringify(new URL('../app/lib/server/whatsappInboxCore.mjs', import.meta.url).href))
    .replace("'@/app/lib/server/whatsappProductCardCore.mjs'", JSON.stringify(coreUrl))
    .replace("'@/app/lib/server/whatsappProductCard'", JSON.stringify(rendererStub));
  const preview = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const request = value => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(value) });
  try {
    globalThis.__previewAuth = { ok: false, response: Response.json({}, { status: 403 }) };
    assert.equal((await preview.POST(request(options))).status, 403);
    const db = database(); globalThis.__previewAuth = { ok: true, uid: 'admin', adminDb: db };
    assert.equal((await preview.POST(request({ ...options, productId: '../invalid' }))).status, 400);
    const prepared = await preview.POST(request(options)); assert.equal(prepared.status, 200);
    assert.match((await prepared.json()).image, /^data:image\/jpeg;base64,/);
    assert.equal((await preview.POST(request(options))).status, 429);
    const hidden = database(); hidden.records.set('products/item-1', { ...product, webPublished: false }); globalThis.__previewAuth.adminDb = hidden;
    assert.equal((await preview.POST(request(options))).status, 409);
    assert.ok(![...hidden.records.keys()].some(key => key.includes('/messages/')));
  } finally { delete globalThis.__previewAuth; }
});
