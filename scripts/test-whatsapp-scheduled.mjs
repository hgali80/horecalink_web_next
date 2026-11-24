import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { INBOX_COLLECTION, normalizeIncoming, persistIncoming } from '../app/lib/server/whatsappInboxCore.mjs';
import { cancelScheduledPlans, DAY, SCHEDULED_COLLECTION, preflightSchedule, scheduleActivityCancellation, validateSchedule, windowOpen } from '../app/lib/server/whatsappScheduledCore.mjs';

const now = Date.UTC(2026, 10, 24, 10);
const base = { id: 'a'.repeat(36), status: 'scheduled', createdAt: new Date(now), scheduledAt: new Date(now + 3600000), kind: 'text',
  senderId: '77001234567', phoneNumberId: '200', text: 'Reviewed', baseIncomingAt: now - 1000 };
const conversation = { senderId: base.senderId, phoneNumberId: base.phoneNumberId, lastIncomingAt: new Date(base.baseIncomingAt) };

test('customer and operator messages cancel a plan once, while old messages and reads do not', () => {
  assert.equal(scheduleActivityCancellation(base, { direction: 'incoming', timestamp: now - 1 }), null);
  assert.equal(scheduleActivityCancellation(base, { direction: 'read', timestamp: now + 1 }), null);
  assert.equal(scheduleActivityCancellation({ ...base, status: 'cancelled' }, { direction: 'incoming', timestamp: now + 1 }), null);
  assert.equal(scheduleActivityCancellation(base, { direction: 'incoming', timestamp: now + 1 }).cancelReason, 'Müşteri mesaj gönderdi');
  assert.equal(scheduleActivityCancellation(base, { direction: 'outgoing', timestamp: now + 1 }).cancelReason, 'Siz mesaj gönderdiniz');
});

test('server preflight blocks new incoming/outgoing activity, a manual lock, and expired 24-hour text', () => {
  assert.equal(preflightSchedule(base, conversation, now + 3600001).ok, true);
  assert.equal(preflightSchedule(base, { ...conversation, lastIncomingAt: new Date(now + 1000) }, now + 3600001).reason, 'customer_message');
  assert.equal(preflightSchedule(base, { ...conversation, lastOutgoingAt: new Date(now + 1000) }, now + 3600001).reason, 'operator_message');
  assert.equal(preflightSchedule(base, { ...conversation, pendingSendId: 'manual' }, now + 3600001).reason, 'manual_send_in_progress');
  assert.equal(preflightSchedule(base, { ...conversation, lastIncomingAt: new Date(now - DAY) }, now + 3600001).reason, 'window_closed');
});

test('same claim changes out of scheduled once and the second scheduler trigger cannot claim it', () => {
  const claimed = { ...base, status: 'sending', claimId: 'scheduled:plan' };
  assert.equal(preflightSchedule(claimed, conversation, now + 3600001).reason, 'plan_changed');
});

test('planning requires future time, a reviewed recipient and bounded approved plan content', () => {
  const valid = { action: 'create', text: 'Reviewed', scheduledAt: now + 60000, baseRevision: 'a'.repeat(64), baseIncomingAt: now - 1000,
    reviewedRecipient: '77001234567', reviewed: true };
  assert.equal(validateSchedule(valid, now).text, 'Reviewed');
  for (const patch of [{ reviewed: false }, { text: '' }, { scheduledAt: now + 1000 }, { reviewedRecipient: 'bad' }, { baseRevision: 'old' }]) assert.throws(() => validateSchedule({ ...valid, ...patch }, now));
  assert.equal(windowOpen(new Date(now), now + DAY - 1), true);
  assert.equal(windowOpen(new Date(now), now + DAY), false);
});

function memoryDb() {
  const records = new Map(); let chain = Promise.resolve();
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => ({ exists: records.has(path), data: () => records.get(path) }), collection: name => collection(`${path}/${name}`) });
  const collection = path => ({
    path, doc: id => ref(`${path}/${id}`),
    where(field, op, value) { return query(path, [{ field, op, value }]); },
  });
  const query = (path, filters, count = 100) => ({
    where(field, op, value) { return query(path, [...filters, { field, op, value }], count); },
    orderBy() { return this; }, limit(value) { return query(path, filters, value); },
    async get() {
      const prefix = `${path}/`;
      const docs = [...records.entries()].filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/')).map(([key, data]) => ({ id: key.slice(prefix.length), ref: ref(key), data: () => data }));
      const matched = docs.filter(doc => filters.every(({ field, op, value }) => {
        const actual = doc.data()[field], time = item => item?.toMillis?.() ?? item?.getTime?.() ?? item;
        if (op === '==') return actual === value;
        if (op === 'in') return value.includes(actual);
        if (op === '<=') return time(actual) <= time(value);
        return false;
      })).slice(0, count);
      return { docs: matched };
    },
  });
  const db = {
    collection,
    runTransaction(callback) {
      const work = chain.then(async () => {
        const writes = []; let writing = false;
        const tx = {
          get: async target => { assert.equal(writing, false); return typeof target.get === 'function' ? target.get() : target.get(); },
          create: (target, data) => { writing = true; assert.equal(records.has(target.path), false); writes.push(() => records.set(target.path, data)); },
          set: (target, data, options = {}) => { writing = true; writes.push(() => records.set(target.path, options.merge ? { ...records.get(target.path), ...data } : data)); },
          update: (target, data) => { writing = true; writes.push(() => records.set(target.path, { ...records.get(target.path), ...data })); },
        };
        const result = await callback(tx); writes.forEach(write => write()); return result;
      });
      chain = work.catch(() => {}); return work;
    },
  };
  return { db, records };
}

test('actual Cloud Scheduler route serializes simultaneous triggers and sends the claimed plan once', async () => {
  const originalFetch = globalThis.fetch, oldAuth = process.env.WHATSAPP_SCHEDULER_SECRET;
  const keys = ['WHATSAPP_SEND_ENABLED','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_API_VERSION'];
  const oldEnv = keys.map(key => [key, process.env[key]]);
  const { db, records } = memoryDb(), id = 'b'.repeat(36), conversationId = 'c'.repeat(64), phoneId = '200', senderId = '77001234567';
  const nowActual = Date.now(), createdAt = new Date(nowActual - 60000);
  records.set(`whatsapp_scheduled_messages/${id}`, { id, conversationId, status: 'scheduled', kind: 'text', text: 'Reviewed', createdAt, scheduledAt: new Date(nowActual - 1000), senderId, phoneNumberId: phoneId, recipient: senderId, baseIncomingAt: nowActual - 600000 });
  records.set(`whatsapp_conversations/${conversationId}`, { senderId, phoneNumberId: phoneId, lastIncomingAt: new Date(nowActual - 600000) });
  const source = (await readFile(new URL('../app/api/jobs/whatsapp-scheduled/route.js', import.meta.url), 'utf8'))
    .replace("import { getAdminServices } from '@/app/lib/server/firebaseAdmin';", 'const getAdminServices = () => globalThis.__scheduledServices;');
  let prepared = source;
  for (const name of ['whatsappReplyCore.mjs','whatsappScheduledCore.mjs','whatsappFollowupCore.mjs','whatsappInboxCore.mjs','whatsappDeliveryCore.mjs']) prepared = prepared.replaceAll(`'@/app/lib/server/${name}'`, JSON.stringify(new URL(`../app/lib/server/${name}`, import.meta.url).href));
  const templateModule = `data:text/javascript;base64,${Buffer.from('export const approvedTemplate = async () => null;').toString('base64')}`;
  prepared = prepared.replaceAll("'@/app/lib/server/whatsappTemplates'", JSON.stringify(templateModule));
  const route = await import(`data:text/javascript;base64,${Buffer.from(prepared).toString('base64')}`);
  globalThis.__scheduledServices = { adminDb: db };
  process.env.WHATSAPP_SCHEDULER_SECRET = 'scheduler-secret'; process.env.WHATSAPP_SEND_ENABLED = 'true'; process.env.WHATSAPP_ACCESS_TOKEN = 'token'; process.env.WHATSAPP_PHONE_NUMBER_ID = phoneId; process.env.WHATSAPP_GRAPH_API_VERSION = 'v26.0';
  let sends = 0;
  globalThis.fetch = async () => { sends++; return Response.json({ messages: [{ id: 'wamid.once' }], contacts: [{ wa_id: senderId }] }); };
  const makeRequest = () => new Request('https://test.invalid/api/jobs/whatsapp-scheduled', { method: 'POST', headers: { 'X-WhatsApp-Scheduler-Secret': 'scheduler-secret' } });
  try {
    const responses = await Promise.all([route.POST(makeRequest()), route.POST(makeRequest())]);
    assert.ok(responses.every(response => response.status === 200));
    assert.equal(sends, 1);
    assert.equal(records.get(`whatsapp_scheduled_messages/${id}`).status, 'accepted');
    assert.equal(records.get(`whatsapp_conversations/${conversationId}`).pendingSendId, null);
    const uncertain = memoryDb(), uncertainId = 'f'.repeat(36), uncertainConversation = '1'.repeat(64);
    uncertain.records.set(`whatsapp_scheduled_messages/${uncertainId}`, { id: uncertainId, conversationId: uncertainConversation, status: 'scheduled', kind: 'text', text: 'Reviewed', createdAt, scheduledAt: new Date(nowActual - 1000), senderId, phoneNumberId: phoneId, recipient: senderId, baseIncomingAt: nowActual - 600000 });
    uncertain.records.set(`whatsapp_conversations/${uncertainConversation}`, { senderId, phoneNumberId: phoneId, lastIncomingAt: new Date(nowActual - 600000) });
    globalThis.__scheduledServices = { adminDb: uncertain.db }; sends = 0;
    globalThis.fetch = async () => { sends++; throw new Error('ambiguous'); };
    const uncertainResponse = await route.POST(makeRequest());
    assert.equal(uncertainResponse.status, 200);
    assert.equal(uncertain.records.get(`whatsapp_scheduled_messages/${uncertainId}`).status, 'unknown');
    assert.equal(uncertain.records.get(`whatsapp_conversations/${uncertainConversation}`).pendingSendId, `scheduled:${uncertainId}`);
    await route.POST(makeRequest()); assert.equal(sends, 1);
  } finally {
    globalThis.fetch = originalFetch; delete globalThis.__scheduledServices;
    if (oldAuth === undefined) delete process.env.WHATSAPP_SCHEDULER_SECRET; else process.env.WHATSAPP_SCHEDULER_SECRET = oldAuth;
    for (const [key, value] of oldEnv) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('actual inbox persistence cancels on new customer messages and signed phone echoes, but ignores duplicates and older messages', async () => {
  const { db, records } = memoryDb(), conversationId = createHash('sha256').update('200:77001234567').digest('hex');
  records.set(`${INBOX_COLLECTION}/${conversationId}`, { senderId: '77001234567', phoneNumberId: '200', lastIncomingAt: new Date(now - 5000) });
  const putPlan = (id, createdAt) => records.set(`${SCHEDULED_COLLECTION}/${id}`, { id, conversationId, status: 'scheduled', createdAt: new Date(createdAt) });
  putPlan('old-message', now); putPlan('customer-new', now);
  const incoming = (id, timestamp) => ({ object: 'whatsapp_business_account', entry: [{ id: '100', changes: [{ field: 'messages', value: { metadata: { phone_number_id: '200' }, messages: [{ id, from: '77001234567', type: 'text', timestamp: String(timestamp / 1000), text: { body: 'hello' } }] } }] }] });
  const receivedAt = now + 20000;
  const oldMessage = normalizeIncoming(incoming('old-before-plan', now - 1000), { wabaId: '100', phoneNumberId: '200', now: receivedAt });
  await persistIncoming(db, oldMessage, receivedAt);
  assert.equal(records.get(`${SCHEDULED_COLLECTION}/old-message`).status, 'scheduled');
  const customerMessage = normalizeIncoming(incoming('customer-after-plan', now + 1000), { wabaId: '100', phoneNumberId: '200', now: receivedAt });
  await persistIncoming(db, customerMessage, receivedAt + 1000);
  assert.equal(records.get(`${SCHEDULED_COLLECTION}/customer-new`).cancelReason, 'Müşteri mesaj gönderdi');
  await persistIncoming(db, customerMessage, receivedAt + 2000);
  assert.equal(records.get(`${SCHEDULED_COLLECTION}/customer-new`).cancelledAt.getTime(), now + 1000);
  putPlan('phone-new', receivedAt + 2000);
  const echo = { object: 'whatsapp_business_account', entry: [{ id: '100', changes: [{ field: 'smb_message_echoes', value: { metadata: { phone_number_id: '200' }, message_echoes: [{ id: 'phone-after-plan', to: '77001234567', type: 'text', timestamp: String((receivedAt + 3000) / 1000), text: { body: 'sent in phone' } }] } }] }] };
  await persistIncoming(db, normalizeIncoming(echo, { wabaId: '100', phoneNumberId: '200', now: receivedAt + 5000 }), receivedAt + 3000);
  assert.equal(records.get(`${SCHEDULED_COLLECTION}/phone-new`).cancelReason, 'Siz mesaj gönderdiniz');
});

test('manual sends transactionally cancel pending plans for that conversation only', async () => {
  const { db, records } = memoryDb(), conversationId = 'd'.repeat(64), otherConversation = 'e'.repeat(64);
  records.set(`${SCHEDULED_COLLECTION}/manual`, { conversationId, status: 'scheduled', createdAt: new Date(now) });
  records.set(`${SCHEDULED_COLLECTION}/other`, { conversationId: otherConversation, status: 'scheduled', createdAt: new Date(now) });
  await db.runTransaction(tx => cancelScheduledPlans(tx, db, conversationId, now + 1000));
  assert.equal(records.get(`${SCHEDULED_COLLECTION}/manual`).status, 'cancelled');
  assert.equal(records.get(`${SCHEDULED_COLLECTION}/manual`).cancelReason, 'Siz mesaj gönderdiniz');
  assert.equal(records.get(`${SCHEDULED_COLLECTION}/other`).status, 'scheduled');
});
