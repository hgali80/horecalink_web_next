import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { automationDecision, notificationId, notificationCurrent, NOTIFICATIONS, SUBSCRIPTIONS } from '../app/lib/server/crmAutomationCore.mjs';
import { normalizeStatuses, persistStatuses, receiptId, RECEIPTS } from '../app/lib/server/whatsappDeliveryCore.mjs';

const now = Date.now(), conv = 'a'.repeat(64), uid = 'operator';
const task = (overrides = {}) => ({ status: 'open', assignedTo: uid, createdBy: uid, title: 'PRIVATE_CUSTOMER_TITLE', notes: 'PRIVATE_NOTES', kind: 'offer', revision: 'r1', notificationCycle: 'cycle-1', createdAt: new Date(now - 100000), followupBaselineAt: new Date(now - 100000), followupBaselineRevision: 'old', dueAt: new Date(now - 1000), ...overrides });
const dataUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const coreUrl = new URL('../app/lib/server/crmAutomationCore.mjs', import.meta.url).href;
let serviceCode = await readFile(new URL('../app/lib/server/crmAutomation.js', import.meta.url), 'utf8');
serviceCode = serviceCode.replace("import 'server-only';", '').replace("'./crmAutomationCore.mjs'", JSON.stringify(coreUrl));
const serviceUrl = dataUrl(serviceCode), { processTask, dispatchPush, runAutomation } = await import(serviceUrl);

function database(initial = []) {
  const records = new Map(initial); let tail = Promise.resolve();
  const snapshot = (path, value) => ({ id: path.split('/').at(-1), ref: ref(path), exists: value !== undefined, data: () => value });
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(path, records.get(path)), collection: name => collection(`${path}/${name}`), set: async (value, options) => records.set(path, options?.merge ? { ...records.get(path), ...value } : value), update: async value => { assert.ok(records.has(path)); records.set(path, { ...records.get(path), ...value }); }, delete: async () => { records.delete(path); } });
  function collection(path, filters = [], order = 'asc', cursor = null, count = Infinity) {
    const query = {
      doc: (id = randomUUID()) => ref(`${path}/${id}`), where: (field, op, value) => { assert.equal(op, '=='); return collection(path, [...filters, [field, value]], order, cursor, count); },
      orderBy: (field, direction = 'asc') => { assert.equal(field, '__name__'); return collection(path, filters, direction, cursor, count); },
      startAfter: value => collection(path, filters, order, typeof value === 'string' ? value : value.id, count), limit: value => collection(path, filters, order, cursor, value),
      get: async () => {
        let docs = [...records].filter(([key, value]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1 && filters.every(([field, expected]) => value[field] === expected)).map(([key, value]) => snapshot(key, value));
        docs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) * (order === 'desc' ? -1 : 1));
        if (cursor) docs = docs.filter(doc => order === 'desc' ? doc.id < cursor : doc.id > cursor);
        docs = docs.slice(0, count); return { docs, size: docs.length };
      },
    }; return query;
  }
  const db = { records, collection, runTransaction: callback => {
    const work = tail.then(async () => { let writing = false; const writes = [];
      const result = await callback({ get: async reference => { assert.equal(writing, false, 'All transaction reads must precede writes'); return reference.get(); },
        set: (reference, value, options) => { writing = true; writes.push(() => records.set(reference.path, options?.merge ? { ...records.get(reference.path), ...value } : value)); },
        create: (reference, value) => { writing = true; assert.ok(!records.has(reference.path)); writes.push(() => records.set(reference.path, value)); },
        update: (reference, value) => { writing = true; assert.ok(records.has(reference.path)); writes.push(() => records.set(reference.path, { ...records.get(reference.path), ...value })); },
        delete: reference => { writing = true; writes.push(() => records.delete(reference.path)); },
      }); writes.forEach(write => write()); return result;
    }); tail = work.catch(() => {}); return work;
  }, batch: () => { const writes = []; return { update: (reference, value) => writes.push(() => reference.update(value)), commit: () => Promise.all(writes.map(write => write())) }; } };
  return db;
}
const owned = () => ['users/operator', { isActive: true, role: 'admin' }];

test('rules distinguish customer replies, explicit callbacks, confirmed sales and source loss', () => {
  const linked = task({ conversationId: conv, offerId: 'offer' });
  const base = { conversation: { lastIncomingAt: new Date(now - 200000), lastIncomingRevision: 'old' }, offer: { salesDocumentId: 'sale' }, sale: { status: 'draft', sourceCommercialOfferId: 'offer' }, now };
  assert.equal(automationDecision(linked, base).action, 'notify');
  assert.deepEqual(automationDecision(linked, { ...base, sale: { status: 'confirmed', sourceCommercialOfferId: 'offer' } }), { action: 'complete', reason: 'sale_confirmed' });
  assert.equal(automationDecision(linked, { ...base, sale: { status: 'confirmed', sourceCommercialOfferId: 'different' } }).action, 'notify');
  assert.equal(automationDecision(linked, { ...base, conversation: null }).reason, 'source_missing');
  assert.equal(automationDecision(linked, { ...base, conversation: { lastIncomingAt: new Date(now), lastIncomingRevision: 'new' } }).reason, 'customer_replied');
  assert.equal(automationDecision(task({ kind: 'callback', conversationId: conv }), { ...base, conversation: { lastIncomingAt: new Date(now) } }).action, 'notify');
  assert.equal(automationDecision(linked, { ...base, preference: { status: 'revoked' } }).reason, 'permission_revoked');
  assert.equal(automationDecision(task({ followupBaselineAt: new Date(now), followupBaselineRevision: 'new' }), { conversation: { lastIncomingAt: new Date(now - 1000), lastIncomingRevision: 'new' }, now }).action, 'notify');
});
test('concurrent due checks create one owner-only notification and rescheduling invalidates it', async () => {
  const db = database([owned(), ['crm_followups/task', task()]]);
  await Promise.all([processTask(db, 'task', now), processTask(db, 'task', now)]);
  const notifications = [...db.records].filter(([path]) => path.startsWith(`${NOTIFICATIONS}/`)); assert.equal(notifications.length, 1);
  const [path, record] = notifications[0]; assert.equal(record.uid, uid); assert.doesNotMatch(JSON.stringify(record), /PRIVATE_/);
  assert.equal(notificationCurrent({ id: path.split('/')[1], ...record }, task()), true);
  assert.equal(notificationCurrent({ id: path.split('/')[1], ...record }, task({ notificationCycle: 'cycle-2' })), false);
  assert.notEqual(notificationId('task', task()), notificationId('task', task({ notificationCycle: 'cycle-2' })));
});
test('reply pauses the task and a confirmed linked sale closes it, while a draft does not', async () => {
  const db = database([owned(), ['crm_followups/task', task({ conversationId: conv })], [`whatsapp_conversations/${conv}`, { lastIncomingAt: new Date(now), lastIncomingRevision: 'new' }]]);
  assert.equal(await processTask(db, 'task', now), 'paused'); assert.equal(db.records.get('crm_followups/task').automationReason, 'customer_replied');
  const sales = database([owned(), ['crm_followups/task', task({ offerId: 'offer' })], ['commercial_offers/offer', { salesDocumentId: 'sale' }], ['erp_sales/sale', { status: 'confirmed', sourceCommercialOfferId: 'offer' }]]);
  assert.equal(await processTask(sales, 'task', now), 'completed'); assert.equal(sales.records.get('crm_followups/task').status, 'completed');
});
test('background scans use a lease and cursor so future tasks cannot starve later due tasks', async () => {
  const db = database([owned()]);
  for (let i = 0; i < 51; i++) db.records.set(`crm_followups/${String(i).padStart(3, '0')}`, task({ dueAt: new Date(now + (i === 50 ? -1000 : 86400000)) }));
  const first = await runAutomation(db, { now }); assert.equal(first.processed, 50); assert.equal(first.more, true); assert.equal(first.notified, 0);
  const second = await runAutomation(db, { now }); assert.equal(second.processed, 1); assert.equal(second.more, false); assert.equal(second.notified, 1);
  db.records.set('crm_automation_state/followups', { leaseUntil: new Date(now + 1000) });
  assert.deepEqual(await runAutomation(db, { now }), { busy: true });
});
test('browser push is claimed once, contains no customer content and skips stale tasks', async () => {
  const db = database([owned(), ['crm_followups/task', task()]]); await processTask(db, 'task', now);
  const id = notificationId('task', task()), ref = db.collection(NOTIFICATIONS).doc(id);
  db.records.set(`${SUBSCRIPTIONS}/token`, { uid, token: 'fake-token', expiresAt: new Date(now + 86400000) }); let sends = 0;
  const push = async message => { sends++; assert.doesNotMatch(JSON.stringify(message), /PRIVATE_|phone|customerName/); assert.deepEqual(message.tokens, ['fake-token']); return { successCount: 1, failureCount: 0, responses: [{ success: true }] }; };
  await Promise.all([dispatchPush(db, ref, push, now), dispatchPush(db, ref, push, now)]); assert.equal(sends, 1);
  db.records.set(ref.path, { ...db.records.get(ref.path), pushState: 'pending' }); db.records.get('crm_followups/task').status = 'completed';
  assert.equal(await dispatchPush(db, ref, push, now), 'skipped'); assert.equal(sends, 1);
});
test('ambiguous push is not repeated and invalid registration tokens are removed', async () => {
  const db = database([owned(), ['crm_followups/task', task()]]); await processTask(db, 'task', now);
  const ref = db.collection(NOTIFICATIONS).doc(notificationId('task', task())); db.records.set(`${SUBSCRIPTIONS}/token`, { uid, token: 'fake', expiresAt: new Date(now + 1000) });
  assert.equal(await dispatchPush(db, ref, async () => { throw new Error('network'); }, now), 'unknown');
  assert.equal(await dispatchPush(db, ref, async () => { assert.fail('must not retry'); }, now), 'skipped');
  db.records.get(ref.path).pushState = 'pending';
  await dispatchPush(db, ref, async () => ({ successCount: 0, failureCount: 1, responses: [{ error: { code: 'messaging/registration-token-not-registered' } }] }), now);
  assert.equal(db.records.has(`${SUBSCRIPTIONS}/token`), false);
});

const event = (status = 'delivered', overrides = {}) => ({ object: 'whatsapp_business_account', entry: [{ id: '100', changes: [{ field: 'messages', value: { metadata: { phone_number_id: '200' }, statuses: [{ id: 'wamid.1', status, timestamp: String(Math.floor(now / 1000)), recipient_id: '77001234567', ...overrides }] } }] }] });
const configuration = { wabaId: '100', phoneNumberId: '200', now };
test('delivery events are account-scoped, bounded and strip provider details', () => {
  const statuses = normalizeStatuses(event('failed', { errors: [{ code: 131047, message: 'PRIVATE_ERROR', error_data: { details: 'PRIVATE_PHONE' } }] }), configuration);
  assert.equal(statuses[0].failureCode, 131047); assert.doesNotMatch(JSON.stringify(statuses), /PRIVATE/);
  assert.deepEqual(normalizeStatuses(event(), { ...configuration, phoneNumberId: 'other' }), []);
  assert.throws(() => normalizeStatuses(event('read', { timestamp: 'NaN' }), configuration));
});
test('signed receipts update only exact mappings, never regress or extend the reply window', async () => {
  const receipt = receiptId('200', 'wamid.1'), messagePath = `whatsapp_conversations/${conv}/messages/outgoing`;
  const db = database([[`whatsapp_conversations/${conv}`, { pendingSendId: 'outgoing', lastIncomingAt: new Date(now - 86400000) }], [messagePath, { metaMessageId: 'wamid.1', phoneNumberId: '200', senderId: '77001234567', sendState: 'unknown' }], [`${RECEIPTS}/${receipt}`, { conversationId: conv, messageId: 'outgoing', recipientId: '77001234567', expiresAt: new Date(now + 10000) }]]);
  await persistStatuses(db, normalizeStatuses(event('read'), configuration), now);
  assert.equal(db.records.get(messagePath).deliveryStatus, 'read'); assert.equal(db.records.get(messagePath).sendState, 'accepted'); assert.equal(db.records.get(`whatsapp_conversations/${conv}`).pendingSendId, null);
  assert.equal(db.records.get(`whatsapp_conversations/${conv}`).lastIncomingAt.getTime(), now - 86400000);
  await persistStatuses(db, normalizeStatuses(event('sent'), configuration), now + 2000); assert.equal(db.records.get(messagePath).deliveryStatus, 'read');
  assert.equal(db.records.get(`${RECEIPTS}/${receipt}`).expiresAt.getTime(), now + 10000);
  await persistStatuses(db, normalizeStatuses(event('read', { id: 'unmapped' }), configuration), now); assert.ok(db.records.has(`${RECEIPTS}/${receiptId('200', 'unmapped')}`));
});

async function route(path, substitutions = {}) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8');
  source = source.replace(/import \{ authorizeWhatsAppRequest, inboxJson(?:, inboxIso)? \} from '@\/app\/lib\/server\/whatsappInbox';/, 'const authorizeWhatsAppRequest = async () => globalThis.__automationAuth; const inboxJson = (body,status=200) => Response.json(body,{status}); const inboxIso = value => value?.toISOString?.() || null;');
  source = source.replace("import { inboxJson } from '@/app/lib/server/whatsappInbox';", 'const inboxJson = (body,status=200) => Response.json(body,{status});');
  source = source.replace("import { getAdminServices } from '@/app/lib/server/firebaseAdmin';", 'const getAdminServices = () => ({adminDb: globalThis.__automationDb});');
  source = source.replace("import { getMessaging } from 'firebase-admin/messaging';", 'const getMessaging = () => {throw new Error("LIVE_PUSH_FORBIDDEN");};');
  for (const name of ['crmAutomationCore.mjs', 'whatsappDeliveryCore.mjs', 'whatsappInboxCore.mjs', 'whatsappReplyCore.mjs']) source = source.replaceAll(`'@/app/lib/server/${name}'`, JSON.stringify(new URL(`../app/lib/server/${name}`, import.meta.url).href));
  source = source.replaceAll("'@/app/lib/server/crmAutomation'", JSON.stringify(serviceUrl));
  source = source.replace("'@/app/lib/crmFollowups.mjs'", JSON.stringify(new URL('../app/lib/crmFollowups.mjs', import.meta.url).href));
  for (const [old, value] of Object.entries(substitutions)) source = source.replace(old, value);
  return import(dataUrl(source));
}
test('notification read APIs isolate owners and subscription tokens are never listed', async () => {
  const db = database([owned(), [`${NOTIFICATIONS}/mine`, { uid, taskId: 'task', status: 'unread', dueAt: new Date(now) }], [`${NOTIFICATIONS}/foreign`, { uid: 'other', taskId: 'other', status: 'unread' }]]);
  globalThis.__automationAuth = { ok: true, uid, adminDb: db };
  try {
    const api = await route('../app/api/admin/crm/notifications/route.js'); const rows = await (await api.GET(new Request('https://test.invalid'))).json();
    assert.equal(rows.notifications.length, 1); assert.equal(rows.notifications[0].id, 'mine'); assert.doesNotMatch(JSON.stringify(rows), /token/);
    assert.equal((await api.PATCH(new Request('https://test.invalid', { method: 'PATCH', body: '{"id":"foreign"}' }))).status, 404);
    assert.equal((await api.PATCH(new Request('https://test.invalid', { method: 'PATCH', body: '{"id":"mine"}' }))).status, 200);
    globalThis.__automationAuth = { ok: false, response: Response.json({}, { status: 403 }) }; assert.equal((await api.GET(new Request('https://test.invalid'))).status, 403);
  } finally { delete globalThis.__automationAuth; }
});
test('scheduled checks are off by default and require the full secret, never a browser user token', async () => {
  const saved = ['CRM_AUTOMATION_ENABLED','CRM_BROWSER_PUSH_ENABLED','CRON_SECRET'].map(key => [key, process.env[key]]);
  try {
    const api = await route('../app/api/jobs/crm-followups/route.js'); globalThis.__automationDb = database([owned()]);
    delete process.env.CRM_AUTOMATION_ENABLED; assert.equal((await api.GET(new Request('https://test.invalid'))).status, 503);
    process.env.CRM_AUTOMATION_ENABLED = 'true'; process.env.CRON_SECRET = 'x'.repeat(32); delete process.env.CRM_BROWSER_PUSH_ENABLED;
    assert.equal((await api.GET(new Request('https://test.invalid', { headers: { authorization: 'Bearer user-token' } }))).status, 401);
    assert.equal((await api.GET(new Request('https://test.invalid', { headers: { authorization: `Bearer ${'x'.repeat(32)}` } }))).status, 200);
  } finally { delete globalThis.__automationDb; for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test('browser registration is bounded, owner-controlled and removable with pushing disabled', async () => {
  const saved = ['CRM_BROWSER_PUSH_ENABLED', 'NEXT_PUBLIC_FIREBASE_VAPID_KEY'].map(key => [key, process.env[key]]);
  try {
    process.env.CRM_BROWSER_PUSH_ENABLED = 'true'; process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = 'public-test-key';
    const db = database([owned()]); globalThis.__automationAuth = { ok: true, uid, adminDb: db };
    const api = await route('../app/api/admin/crm/notifications/subscription/route.js');
    const token = 'a'.repeat(100), post = value => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(value) });
    const result = await (await api.POST(post({ token }))).json(); assert.ok(result.id);
    assert.equal((await api.POST(post({ token }))).status, 200); assert.equal([...db.records.keys()].filter(key => key.startsWith(`${SUBSCRIPTIONS}/`)).length, 1);
    const config = await (await api.GET(new Request('https://test.invalid'))).json(); assert.equal(config.vapidKey, 'public-test-key'); assert.doesNotMatch(JSON.stringify(config), /a{100}/);
    globalThis.__automationAuth.uid = 'other';
    assert.equal((await api.DELETE(new Request('https://test.invalid', { method: 'DELETE', body: JSON.stringify({ id: result.id }) }))).status, 403);
    globalThis.__automationAuth.uid = uid; delete process.env.CRM_BROWSER_PUSH_ENABLED;
    assert.equal((await api.DELETE(new Request('https://test.invalid', { method: 'DELETE', body: JSON.stringify({ id: result.id }) }))).status, 200);
    assert.equal(db.records.has(`${SUBSCRIPTIONS}/${result.id}`), false);
    process.env.CRM_BROWSER_PUSH_ENABLED = 'true';
    for (let i = 0; i < 10; i++) db.records.set(`${SUBSCRIPTIONS}/${i}`, { uid, token: 'existing', expiresAt: new Date(now + 86400000) });
    assert.equal((await api.POST(post({ token }))).status, 409);
    for (let i = 0; i < 10; i++) db.records.get(`${SUBSCRIPTIONS}/${i}`).expiresAt = new Date(now - 1000);
    assert.equal((await api.POST(post({ token }))).status, 200); assert.equal([...db.records.keys()].filter(key => key.startsWith(`${SUBSCRIPTIONS}/`)).length, 1);
  } finally { delete globalThis.__automationAuth; for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test('push worker displays generic content only and ignores arbitrary notification links', async () => {
  const api = await route('../app/firebase-messaging-sw.js/route.js', { "import { firebaseConfig } from '@/firebase/config';": 'const firebaseConfig = {projectId:"test"};' });
  const response = api.GET(); assert.equal(response.headers.get('Service-Worker-Allowed'), '/crm-push/');
  const handlers = {}, shown = [], opened = []; let background;
  vm.runInNewContext(await response.text(), { self: { addEventListener: (type, callback) => { handlers[type] = callback; }, registration: { showNotification: async (...args) => shown.push(args) } }, clients: { openWindow: async path => opened.push(path) }, importScripts: (...urls) => { assert.ok(urls.every(url => url.startsWith('https://www.gstatic.com/firebasejs/'))); }, firebase: { initializeApp: () => {}, messaging: () => ({ onBackgroundMessage: callback => { background = callback; } }) } });
  await background({ data: { type: 'crm_due', notificationId: 'valid_id', customerName: 'PRIVATE_NAME', body: 'PRIVATE_MESSAGE', link: 'https://evil.invalid' } });
  assert.equal(shown.length, 1); assert.doesNotMatch(JSON.stringify(shown), /PRIVATE|evil/);
  await new Promise(resolve => handlers.notificationclick({ notification: { close: () => {} }, waitUntil: promise => promise.then(resolve) }));
  assert.deepEqual(opened, ['/satissitok/admin/crm']);
});
test('a receipt arriving before the send response is attached atomically without guessing unknown sends', async () => {
  const keys = ['WHATSAPP_SEND_ENABLED','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_API_VERSION'], saved = keys.map(key => [key, process.env[key]]), originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, { WHATSAPP_SEND_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'fake', WHATSAPP_PHONE_NUMBER_ID: '200', WHATSAPP_GRAPH_API_VERSION: 'v26.0' });
    const db = database([[`whatsapp_conversations/${conv}`, { senderId: '77001234567', phoneNumberId: '200', lastIncomingAt: new Date(now) }]]);
    await persistStatuses(db, normalizeStatuses(event('read', { id: 'wamid.race' }), configuration), now);
    globalThis.__automationAuth = { ok: true, uid, adminDb: db };
    globalThis.fetch = async () => Response.json({ messages: [{ id: 'wamid.race' }] });
    const api = await route('../app/api/admin/whatsapp/conversations/[conversationId]/reply/route.js');
    const result = await api.POST(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ action: 'send', text: 'Reviewed response', reviewed: true, requestId: randomUUID(), baseIncomingAt: now, baseRevision: String(now) }) }), { params: Promise.resolve({ conversationId: conv }) });
    assert.equal(result.status, 200); const message = [...db.records.values()].find(value => value.direction === 'outgoing'); assert.equal(message.deliveryStatus, 'read');
    const unknown = database([[`whatsapp_conversations/${conv}`, { pendingSendId: 'unresolved', lastIncomingAt: new Date(now) }]]);
    await persistStatuses(unknown, normalizeStatuses(event('delivered', { id: 'unmapped' }), configuration), now);
    assert.equal(unknown.records.get(`whatsapp_conversations/${conv}`).pendingSendId, 'unresolved');
  } finally { globalThis.fetch = originalFetch; delete globalThis.__automationAuth; for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test('webhook delivery processing still requires the raw-body Meta signature', async () => {
  const keys = ['WHATSAPP_INBOX_ENABLED','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_WABA_ID','WHATSAPP_PHONE_NUMBER_ID'], saved = keys.map(key => [key,process.env[key]]);
  try {
    Object.assign(process.env, { WHATSAPP_INBOX_ENABLED: 'true', WHATSAPP_APP_SECRET: 'test-secret', WHATSAPP_VERIFY_TOKEN: 'verify', WHATSAPP_WABA_ID: '100', WHATSAPP_PHONE_NUMBER_ID: '200' });
    const db = database(); globalThis.__automationDb = db;
    const webhook = await route('../app/api/webhooks/whatsapp/route.js', { "import { NextResponse } from 'next/server';": 'const NextResponse = { json: (body,options) => Response.json(body,options) };' });
    const body = JSON.stringify(event());
    assert.equal((await webhook.POST(new Request('https://test.invalid', { method: 'POST', body }))).status, 401); assert.equal(db.records.size, 0);
    const signature = `sha256=${createHmac('sha256','test-secret').update(body).digest('hex')}`;
    assert.equal((await webhook.POST(new Request('https://test.invalid', { method: 'POST', headers: { 'x-hub-signature-256': signature }, body }))).status, 200);
    assert.ok(db.records.has(`${RECEIPTS}/${receiptId('200','wamid.1')}`));
  } finally { delete globalThis.__automationDb; for (const [key,value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('pending browser notifications continue beyond the first batch even when the task scan is complete', async () => {
  const db = database([owned()]);
  db.records.set(`${SUBSCRIPTIONS}/token`, { uid, token: 'fake', expiresAt: new Date(now + 86400000) });
  for (let i = 0; i < 25; i++) {
    const id = `pending-${i}`, record = task(); db.records.set(`crm_followups/${id}`, record);
    db.records.set(`${NOTIFICATIONS}/${notificationId(id, record)}`, { uid, taskId: id, kind: 'due', status: 'unread', pushState: 'pending', expiresAt: new Date(now + 86400000) });
  }
  let sent = 0;
  const sendPush = async () => { sent++; return { successCount: 1, failureCount: 0, responses: [{ success: true }] }; };
  const first = await runAutomation(db, { now, sendPush });
  assert.equal(first.more, false); assert.equal(first.morePush, true); assert.equal(sent, 20);
  const second = await runAutomation(db, { now, sendPush, scanTasks: false });
  assert.equal(second.processed, 0); assert.equal(second.morePush, false); assert.equal(sent, 25);
});
test('expired run budget leaves the cursor resumable and an ambiguous timed-out push is not repeated', async () => {
  const db = database([owned(), ['crm_followups/task', task()]]);
  const result = await runAutomation(db, { now, deadline: Date.now() - 1 });
  assert.equal(result.processed, 0); assert.equal(result.more, true);
  await processTask(db, 'task', now);
  const ref = db.collection(NOTIFICATIONS).doc(notificationId('task', task()));
  db.records.set(`${SUBSCRIPTIONS}/token`, { uid, token: 'fake', expiresAt: new Date(now + 86400000) });
  assert.equal(await dispatchPush(db, ref, () => new Promise(() => {}), now, 5), 'unknown');
  assert.equal(await dispatchPush(db, ref, async () => { assert.fail('Must not resend'); }, now), 'skipped');
});
