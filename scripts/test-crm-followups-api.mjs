import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Exercise the actual route handlers with an isolated in-memory store. No Firebase or paid calls.
const records = new Map();
const iso = value => value?.toDate?.()?.toISOString() || value?.toISOString?.() || null;
const snap = (id, value) => ({ id, exists: !!value, data: () => value });
function collection(name) {
  return { doc(id = `event-${records.size}`) {
    const key = `${name}/${id}`;
    return { key, id, get: async () => snap(id, records.get(key)), collection: sub => collection(`${key}/${sub}`) };
  } };
}
const db = { collection, runTransaction: async handler => handler({
  get: ref => ref.get(),
  create: (ref, data) => { assert.ok(!records.has(ref.key)); records.set(ref.key, data); },
  update: (ref, data) => records.set(ref.key, { ...records.get(ref.key), ...data }),
}) };
let authorized = true;
globalThis.__crmApiTest = {
  authorizeWhatsAppRequest: async () => authorized ? { ok: true, uid: 'operator', adminDb: db } : { ok: false, response: new Response('{}', { status: 403 }) },
  inboxJson: (body, status = 200) => Response.json(body, { status }), inboxIso: iso,
};
let code = await readFile(new URL('../app/api/admin/crm/followups/route.js', import.meta.url), 'utf8');
code = code.replace("import { authorizeWhatsAppRequest, inboxJson, inboxIso } from '@/app/lib/server/whatsappInbox';", 'const { authorizeWhatsAppRequest, inboxJson, inboxIso } = globalThis.__crmApiTest;');
code = code.replace("'@/app/lib/crmFollowups.mjs'", JSON.stringify(new URL('../app/lib/crmFollowups.mjs', import.meta.url).href));
const route = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const request = (method, body) => new Request('http://localhost/api/admin/crm/followups', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const payload = { id: 'task-1', title: 'Teklif takibi', customerName: 'Restoran', kind: 'offer', dueAt: '2026-11-01T05:00:00.000Z', offerId: 'offer-1' };

test('every route rejects unauthorized users before accessing data', async () => {
  authorized = false;
  for (const method of ['GET', 'POST', 'PATCH']) assert.equal((await route[method](request(method))).status, 403);
  assert.equal(records.size, 0); authorized = true;
});
test('invalid or oversized bodies and missing linked records create nothing', async () => {
  assert.equal((await route.POST(request('POST', null))).status, 400);
  assert.equal((await route.POST(request('POST', { ...payload, notes: 'x'.repeat(17000) }))).status, 413);
  assert.equal((await route.POST(request('POST', payload))).status, 404);
  assert.equal(records.size, 0);
});
test('retrying a creation ID makes one task and one audit event', async () => {
  records.set('commercial_offers/offer-1', { offerNo: 'HL-1', buyer: { companyName: 'Restoran' } });
  assert.equal((await route.POST(request('POST', payload))).status, 200);
  assert.equal((await route.POST(request('POST', payload))).status, 200);
  assert.equal([...records.keys()].filter(key => key.startsWith('crm_followups/')).length, 2);
  const task = records.get('crm_followups/task-1');
  assert.equal(task.assignedTo, 'operator'); assert.equal(task.status, 'open'); assert.equal(task.labels.offer, 'HL-1');
});
test('task completion is audited and a stale second tab is rejected', async () => {
  const revision = records.get('crm_followups/task-1').revision;
  assert.equal((await route.PATCH(request('PATCH', { id: 'task-1', revision, action: 'complete' }))).status, 200);
  assert.equal(records.get('crm_followups/task-1').status, 'completed');
  assert.equal((await route.PATCH(request('PATCH', { id: 'task-1', revision, action: 'cancel' }))).status, 409);
  assert.equal([...records.keys()].filter(key => key.includes('/events/')).length, 2);
});
