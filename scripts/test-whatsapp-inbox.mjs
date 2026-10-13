import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { INBOX_COLLECTION, normalizeIncoming, persistIncoming, readBoundedBody, verifyWebhookSignature } from '../app/lib/server/whatsappInboxCore.mjs';

const now = 1800000000000;
const config = { wabaId: '100', phoneNumberId: '200', now };
const message = (id = 'wamid.a', timestamp = now / 1000) => ({ id, from: '77001234567', type: 'text', timestamp: String(timestamp), text: { body: '<script>hello</script>' } });
const event = (messages = [message()]) => ({ object: 'whatsapp_business_account', entry: [{ id: '100', changes: [{ field: 'messages', value: { metadata: { phone_number_id: '200' }, contacts: [{ wa_id: '77001234567', profile: { name: 'Customer' } }], messages } }] }] });

function fakeDb() {
  const records = new Map();
  let queue = Promise.resolve();
  const ref = path => ({ path, collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }) });
  const db = {
    collection: name => ({ doc: id => ref(`${name}/${id}`) }),
    runTransaction: work => {
      const result = queue.then(async () => {
        const writes = [];
        let wrote = false;
        await work({
          get: async doc => { assert.equal(wrote, false, 'reads must precede writes'); return { exists: records.has(doc.path), data: () => records.get(doc.path) }; },
          create: (doc, data) => { wrote = true; assert.equal(records.has(doc.path), false); writes.push([doc.path, data]); },
          set: (doc, data) => { wrote = true; writes.push([doc.path, { ...records.get(doc.path), ...data }]); },
        });
        writes.forEach(([path, data]) => records.set(path, data));
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  return { db, records };
}

test('signature checks exact bytes, rejects forgery and malformed signature', () => {
  const raw = Buffer.from(JSON.stringify(event()));
  const signature = `sha256=${createHmac('sha256', 'test-secret').update(raw).digest('hex')}`;
  assert.equal(verifyWebhookSignature(raw, signature, 'test-secret'), true);
  for (const [body, sig, secret] of [[Buffer.concat([raw, Buffer.from(' ')]), signature, 'test-secret'], [raw, signature, 'wrong'], [raw, null, 'test-secret'], [raw, 'sha256=ab', 'test-secret'], [raw, signature, '']]) assert.equal(verifyWebhookSignature(body, sig, secret), false);
});

test('streaming body limit applies without content-length', async () => {
  const request = new Request('https://test.invalid', { method: 'POST', body: '12345' });
  await assert.rejects(readBoundedBody(request, 4), /BODY_TOO_LARGE/);
  assert.equal((await readBoundedBody(new Request('https://test.invalid', { method: 'POST', body: '1234' }), 4)).toString(), '1234');
});

test('all matching changes processed; foreign WABA/phone and status events ignored', () => {
  const payload = event();
  payload.entry[0].changes.push(...event([message('wamid.b')]).entry[0].changes);
  payload.entry.push({ ...event([message('foreign')]).entry[0], id: '999' });
  const wrongPhone = event([message('wrong-phone')]).entry[0].changes[0];
  wrongPhone.value.metadata.phone_number_id = '999';
  payload.entry[0].changes.push(wrongPhone, { field: 'messages', value: { metadata: { phone_number_id: '200' }, statuses: [{ id: 'status', status: 'delivered' }] } });
  const result = normalizeIncoming(payload, config);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(item => item.metaMessageId), ['wamid.a', 'wamid.b']);
  assert.equal(result[0].text, '<script>hello</script>');
  assert.match(result[0].conversationId, /^[a-f0-9]{64}$/);
});

test('unsupported media records type but no media URL or raw payload', () => {
  const incoming = { ...message(), type: 'image', image: { id: 'media', url: 'https://private.invalid', caption: 'private' } };
  const [normalized] = normalizeIncoming(event([incoming]), config);
  assert.equal(normalized.type, 'image'); assert.equal(normalized.text, '');
  assert.doesNotMatch(JSON.stringify(normalized), /private|media/);
});

test('invalid incoming messages and excessive batches fail before storage', () => {
  for (const patch of [{ from: '../x' }, { timestamp: 'NaN' }, { timestamp: String(now / 1000 + 1000) }, { text: {} }, { id: '' }]) assert.throws(() => normalizeIncoming(event([{ ...message(), ...patch }]), config), /INVALID_MESSAGE/);
  assert.throws(() => normalizeIncoming(event(Array.from({ length: 101 }, (_, i) => message(`id${i}`))), config), /TOO_MANY_MESSAGES/);
  assert.throws(() => normalizeIncoming({}, config), /INVALID_EVENT/);
});

test('duplicate and concurrent receipts store once and do not extend retention', async () => {
  const { db, records } = fakeDb();
  const normalized = normalizeIncoming(event([message(), message()]), config);
  assert.equal(normalized.length, 1);
  await Promise.all([persistIncoming(db, normalized, now), persistIncoming(db, normalized, now + 1000)]);
  assert.equal(records.size, 2);
  const stored = records.get(`${INBOX_COLLECTION}/${normalized[0].conversationId}/messages/${normalized[0].id}`);
  assert.equal(stored.receivedAt.getTime(), now);
  assert.equal(stored.expiresAt.getTime(), now + 90 * 86400000);
  assert.equal([...records.keys()].some(path => /products|catalog/.test(path)), false);
});

test('out-of-order messages never replace latest preview; latest in a batch wins', async () => {
  const { db, records } = fakeDb();
  const recent = normalizeIncoming(event([{ ...message('recent'), text: { body: 'new' } }]), config);
  const older = normalizeIncoming(event([{ ...message('old', now / 1000 - 60), text: { body: 'old' } }]), config);
  await persistIncoming(db, recent, now);
  await persistIncoming(db, older, now + 1000);
  assert.equal(records.get(`${INBOX_COLLECTION}/${recent[0].conversationId}`).lastMessagePreview, 'new');
  assert.equal(records.size, 3);
  const other = fakeDb();
  await persistIncoming(other.db, [...recent, ...older], now);
  assert.equal(other.records.get(`${INBOX_COLLECTION}/${recent[0].conversationId}`).lastMessagePreview, 'new');
});

// Test the actual authorization helper without Firebase/network access.
const authSource = (await readFile(new URL('../app/lib/server/whatsappInbox.js', import.meta.url), 'utf8'))
  .replace("import 'server-only';", '')
  .replace("import { NextResponse } from 'next/server';", 'const NextResponse = { json: (body, options) => Response.json(body, options) };')
  .replace("import { getAdminServices } from './firebaseAdmin';", 'const getAdminServices = () => globalThis.__inboxAuthServices;')
  .replace("import { INBOX_ROLES } from './whatsappInboxCore.mjs';", "const INBOX_ROLES = new Set(['admin', 'super_admin']);");
const { authorizeWhatsAppRequest, inboxJson } = await import(`data:text/javascript;base64,${Buffer.from(authSource).toString('base64')}`);
test('API authorization rejects absent, revoked, inactive, missing and non-admin users', async () => {
  let verifyArgs;
  let record = { role: 'admin', isActive: true };
  let invalid = false;
  globalThis.__inboxAuthServices = {
    adminAuth: { verifyIdToken: async (...args) => { verifyArgs = args; if (invalid) throw new Error('sensitive token'); return { uid: 'admin' }; } },
    adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => record }) }) }) },
  };
  const request = token => new Request('https://test.invalid', { headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal((await authorizeWhatsAppRequest(request())).response.status, 401);
  assert.equal((await authorizeWhatsAppRequest(request('token'))).ok, true);
  assert.deepEqual(verifyArgs, ['token', true]);
  for (const value of [undefined, { role: 'admin', isActive: false }, { role: 'viewer', isActive: true }, { role: 'sales', isActive: true }, { role: 'admin' }]) {
    record = value;
    assert.equal((await authorizeWhatsAppRequest(request('token'))).response.status, 403);
  }
  invalid = true;
  const result = await authorizeWhatsAppRequest(request('token'));
  assert.equal(result.response.status, 401);
  assert.doesNotMatch(await result.response.text(), /sensitive token/);
  assert.equal(inboxJson({}).headers.get('cache-control'), 'private, no-store');
  delete globalThis.__inboxAuthServices;
});

const coreUrl = new URL('../app/lib/server/whatsappInboxCore.mjs', import.meta.url).href;
const webhookSource = (await readFile(new URL('../app/api/webhooks/whatsapp/route.js', import.meta.url), 'utf8'))
  .replace("import { NextResponse } from 'next/server';", 'const NextResponse = { json: (body, options) => Response.json(body, options) };')
  .replace("import { getAdminServices } from '@/app/lib/server/firebaseAdmin';", 'const getAdminServices = () => globalThis.__inboxWebhookServices;')
  .replace("'@/app/lib/server/whatsappInboxCore.mjs'", JSON.stringify(coreUrl));
const webhook = await import(`data:text/javascript;base64,${Buffer.from(webhookSource).toString('base64')}`);
test('actual webhook route is off by default, verifies challenge/signature and retries database failure', async () => {
  const keys = ['WHATSAPP_INBOX_ENABLED', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_WABA_ID', 'WHATSAPP_PHONE_NUMBER_ID'];
  const saved = keys.map(key => [key, process.env[key]]);
  try {
    delete process.env.WHATSAPP_INBOX_ENABLED;
    assert.equal((await webhook.GET(new Request('https://test.invalid'))).status, 503);
    Object.assign(process.env, { WHATSAPP_INBOX_ENABLED: 'true', WHATSAPP_APP_SECRET: 'fake-secret', WHATSAPP_VERIFY_TOKEN: 'fake-verify', WHATSAPP_WABA_ID: '100', WHATSAPP_PHONE_NUMBER_ID: '200' });
    const challenge = await webhook.GET(new Request('https://test.invalid?hub.mode=subscribe&hub.verify_token=fake-verify&hub.challenge=12345'));
    assert.equal(challenge.status, 200); assert.equal(await challenge.text(), '12345');
    assert.equal((await webhook.GET(new Request('https://test.invalid?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345'))).status, 403);
    const payload = event([message('live-test', Math.floor(Date.now() / 1000))]);
    const raw = JSON.stringify(payload);
    const signed = () => new Request('https://test.invalid', { method: 'POST', body: raw, headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'fake-secret').update(raw).digest('hex')}` } });
    const database = fakeDb();
    globalThis.__inboxWebhookServices = { adminDb: database.db };
    assert.equal((await webhook.POST(new Request('https://test.invalid', { method: 'POST', body: raw }))).status, 401);
    assert.equal(database.records.size, 0);
    assert.equal((await webhook.POST(signed())).status, 200);
    assert.equal((await webhook.POST(signed())).status, 200);
    assert.equal(database.records.size, 2);
    globalThis.__inboxWebhookServices = { adminDb: { runTransaction: async () => { throw new Error('private database credential'); }, collection: database.db.collection } };
    const failed = await webhook.POST(signed());
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /private database credential/);
  } finally {
    for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    delete globalThis.__inboxWebhookServices;
  }
});

test('actual list routes enforce authorization, page limits and conversation-scoped message cursor', async () => {
  const fixtures = Array.from({ length: 51 }, (_, index) => ({ id: index.toString(16).padStart(64, '0'), exists: true, data: () => ({ senderId: '77001234567', timestamp: now, lastIncomingAt: { toDate: () => new Date(now) }, text: 'hello', type: 'text' }) }));
  const calls = [];
  const collection = path => ({
    orderBy: field => {
      calls.push(['orderBy', path, field]);
      const query = { startAfter: doc => { calls.push(['startAfter', path, doc.id]); return query; }, limit: count => { calls.push(['limit', path, count]); return { get: async () => ({ docs: fixtures.slice(0, count), size: Math.min(count, fixtures.length) }) }; } };
      return query;
    },
    doc: id => ({ get: async () => ({ ...fixtures[0], id }), collection: name => collection(`${path}/${id}/${name}`) }),
  });
  globalThis.__inboxApiAuth = { ok: false, response: inboxJson({ error: 'denied' }, 403) };
  globalThis.__inboxApiJson = inboxJson;
  globalThis.__inboxApiIso = value => value?.toDate?.()?.toISOString() || null;
  async function loadRoute(path) {
    const source = (await readFile(new URL(path, import.meta.url), 'utf8'))
      .replace("import { authorizeWhatsAppRequest, inboxIso, inboxJson } from '@/app/lib/server/whatsappInbox';", 'const authorizeWhatsAppRequest = async () => globalThis.__inboxApiAuth; const inboxJson = globalThis.__inboxApiJson; const inboxIso = globalThis.__inboxApiIso;')
      .replace("'@/app/lib/server/whatsappInboxCore.mjs'", JSON.stringify(coreUrl));
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  try {
    const conversations = await loadRoute('../app/api/admin/whatsapp/conversations/route.js');
    const messages = await loadRoute('../app/api/admin/whatsapp/conversations/[conversationId]/messages/route.js');
    const request = cursor => new Request(`https://test.invalid${cursor ? `?cursor=${cursor}` : ''}`);
    assert.equal((await conversations.GET(request())).status, 403);
    assert.equal((await messages.GET(request(), {})).status, 403);
    assert.equal(calls.length, 0);
    globalThis.__inboxApiAuth = { ok: true, adminDb: { collection } };
    const list = await (await conversations.GET(request())).json();
    assert.equal(list.conversations.length, 30); assert.equal(list.nextCursor, fixtures[29].id);
    assert.equal((await conversations.GET(request('../bad'))).status, 400);
    await conversations.GET(request(fixtures[29].id));
    assert.deepEqual(calls.find(item => item[0] === 'startAfter'), ['startAfter', INBOX_COLLECTION, fixtures[29].id]);
    const conversationId = fixtures[5].id;
    const result = await (await messages.GET(request(fixtures[49].id), { params: Promise.resolve({ conversationId }) })).json();
    assert.equal(result.messages.length, 50); assert.equal(result.nextCursor, fixtures[49].id);
    assert.ok(calls.some(item => item[0] === 'startAfter' && item[1] === `${INBOX_COLLECTION}/${conversationId}/messages`));
  } finally {
    delete globalThis.__inboxApiAuth; delete globalThis.__inboxApiJson; delete globalThis.__inboxApiIso;
  }
});
