import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { normalizeTemplate, renderTemplate, templateRequest, checkPermission, checkTask, checkCooldown } from '../app/lib/server/whatsappFollowupCore.mjs';

const convId = 'a'.repeat(64), taskId = 'task-1', now = Date.now();
const rawTemplate = { id: '321', name: 'horecalink_followup', language: 'ru', status: 'APPROVED', category: 'MARKETING', parameter_format: 'POSITIONAL', components: [{ type: 'BODY', text: 'Здравствуйте, {{1}}! Ваш запрос {{2}} ещё актуален?' }, { type: 'FOOTER', text: 'HorecaLink' }] };
const template = normalizeTemplate(rawTemplate);
const templateBody = { action: 'send_template', requestId: '11111111-1111-4111-8111-111111111111', followupId: taskId, followupRevision: 'r1', permissionRevision: 'p1', templateId: template.id, templateName: template.name, templateLanguage: template.language, templateRevision: template.revision, parameters: ['Роман', 'HL-77'], reviewedText: renderTemplate(template, ['Роман', 'HL-77']), reviewed: true, reviewedRecipient: '77001234567', baseIncomingAt: now - 26 * 3600000, baseRevision: String(now - 26 * 3600000) };
const request = body => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(body) });
const context = { params: Promise.resolve({ conversationId: convId }) };
const moduleUrl = path => new URL(`../app/lib/server/${path}`, import.meta.url).href;
const dataModule = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
let serviceSource = await readFile(new URL('../app/lib/server/whatsappTemplates.js', import.meta.url), 'utf8');
serviceSource = serviceSource.replace("import 'server-only';", '').replace("'./whatsappFollowupCore.mjs'", JSON.stringify(moduleUrl('whatsappFollowupCore.mjs'))).replace("'./whatsappReplyCore.mjs'", JSON.stringify(moduleUrl('whatsappReplyCore.mjs')));
const serviceUrl = dataModule(serviceSource);
async function loadRoute(path) {
  let code = await readFile(new URL(path, import.meta.url), 'utf8');
  code = code.replace(/import \{ authorizeWhatsAppRequest, inboxJson(?:, inboxIso)? \} from '@\/app\/lib\/server\/whatsappInbox';/, 'const authorizeWhatsAppRequest = async () => globalThis.__followAuth; const inboxJson = (body,status=200) => Response.json(body,{status}); const inboxIso = value => value?.toISOString?.() || null;');
  for (const name of ['whatsappInboxCore.mjs', 'whatsappReplyCore.mjs', 'whatsappFollowupCore.mjs', 'whatsappDeliveryCore.mjs']) code = code.replaceAll(`'@/app/lib/server/${name}'`, JSON.stringify(moduleUrl(name)));
  code = code.replaceAll("'@/app/lib/server/whatsappTemplates'", JSON.stringify(serviceUrl));
  return import(dataModule(code));
}
const follow = await loadRoute('../app/api/admin/whatsapp/conversations/[conversationId]/followup/route.js');
const reply = await loadRoute('../app/api/admin/whatsapp/conversations/[conversationId]/reply/route.js');
const list = await loadRoute('../app/api/admin/whatsapp/templates/route.js');

function database({ recent = false } = {}) {
  const base = recent ? now : templateBody.baseIncomingAt;
  const records = new Map([
    [`whatsapp_conversations/${convId}`, { senderId: '77001234567', phoneNumberId: '200', lastIncomingAt: new Date(base) }],
    [`crm_followups/${taskId}`, { status: 'open', revision: 'r1', conversationId: convId, kind: 'offer', offerId: 'offer-1', title: 'PRIVATE_TITLE', notes: 'PRIVATE_NOTES', phone: 'PRIVATE_PHONE', createdAt: new Date(base - 1000), dueAt: new Date(now) }],
    ['commercial_offers/offer-1', { offerNo: 'HL-77', buyer: { phone: 'PRIVATE_BUYER' }, totals: { total: 99999 } }],
    [`crm_contact_preferences/${convId}`, { status: 'granted', revision: 'p1', recordedAt: new Date(now), source: 'PRIVATE_SOURCE' }],
  ]);
  const doc = path => ({ path, id: path.split('/').at(-1), get: async () => ({ exists: records.has(path), data: () => records.get(path) }), collection: name => collection(`${path}/${name}`) });
  const collection = path => ({ doc: (id = randomUUID()) => doc(`${path}/${id}`), orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [{ data: () => ({ type: 'text', direction: 'incoming', text: 'Нужен стол.' }) }] }) }) }) });
  let tail = Promise.resolve();
  const db = { records, collection, afterTransaction: null, runTransaction: callback => {
    const work = tail.then(async () => { let writing = false; const writes = [];
      const result = await callback({ get: async ref => { assert.equal(writing, false); return ref.get(); }, create: (ref, value) => { writing = true; assert.ok(!records.has(ref.path)); writes.push(() => records.set(ref.path, value)); }, set: (ref, value) => { writing = true; writes.push(() => records.set(ref.path, value)); }, update: (ref, value) => { writing = true; writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...value })); } });
      writes.forEach(write => write()); db.afterTransaction?.(); return result;
    }); tail = work.catch(() => {}); return work;
  } }; return db;
}
async function isolated(callback) {
  const savedFetch = globalThis.fetch, keys = ['WHATSAPP_SEND_ENABLED', 'WHATSAPP_TEMPLATE_SEND_ENABLED', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_WABA_ID', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_GRAPH_API_VERSION', 'WHATSAPP_TEST_RECIPIENT_MAP', 'WHATSAPP_DRAFTS_ENABLED', 'OPENAI_API_KEY', 'OPENAI_MODEL'];
  const saved = keys.map(key => [key, process.env[key]]);
  try {
    Object.assign(process.env, { WHATSAPP_SEND_ENABLED: 'true', WHATSAPP_TEMPLATE_SEND_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'fake', WHATSAPP_WABA_ID: '100', WHATSAPP_PHONE_NUMBER_ID: '200', WHATSAPP_GRAPH_API_VERSION: 'v26.0', WHATSAPP_DRAFTS_ENABLED: 'true', OPENAI_API_KEY: 'fake', OPENAI_MODEL: 'configured-model' });
    delete process.env.WHATSAPP_TEST_RECIPIENT_MAP;
    await callback();
  } finally { globalThis.fetch = savedFetch; delete globalThis.__followAuth; for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}

test('template parser rejects unapproved, unsupported and ambiguous formats', () => {
  assert.equal(template.parameterCount, 2); assert.match(renderTemplate(template, ['Роман', '$&']), /\$&/);
  assert.throws(() => renderTemplate(template, ['one'])); assert.throws(() => renderTemplate(template, ['one', 'line\nbreak']));
  for (const value of [{ ...rawTemplate, status: 'PAUSED' }, { ...rawTemplate, category: 'AUTHENTICATION' }, { ...rawTemplate, parameter_format: 'NAMED' }, { ...rawTemplate, components: [{ type: 'BODY', text: '{{2}}' }] }, { ...rawTemplate, components: [...rawTemplate.components, { type: 'BUTTONS' }] }, { ...rawTemplate, components: [{ type: 'BODY', text: '{{name}}' }] }]) assert.equal(normalizeTemplate(value), null);
  for (const changes of [{ reviewed: false }, { templateName: '../other' }, { followupRevision: '' }, { permissionRevision: '' }, { parameters: [9] }]) assert.throws(() => templateRequest({ ...templateBody, ...changes }));
  assert.throws(() => checkPermission({ status: 'revoked' })); assert.throws(() => checkTask({ status: 'open', conversationId: 'other' }, convId));
  assert.throws(() => checkCooldown({ lastFollowupSentAt: new Date(now) }, now + 1000));
});
test('follow-up, consent and template list routes enforce server authorization', () => isolated(async () => {
  globalThis.__followAuth = { ok: false, response: Response.json({}, { status: 403 }) };
  assert.equal((await follow.GET(new Request(`https://test.invalid?taskId=${taskId}`), context)).status, 403);
  assert.equal((await follow.POST(request({ action: 'consent' }), context)).status, 403);
  assert.equal((await list.GET(new Request('https://test.invalid'))).status, 403);
}));
test('consent has explicit source, optimistic revision and an audit trail', () => isolated(async () => {
  const db = database(); globalThis.__followAuth = { ok: true, uid: 'admin', adminDb: db };
  const change = { action: 'consent', status: 'revoked', source: 'Customer asked to stop', confirmed: true, revision: 'p1' };
  assert.equal((await follow.POST(request({ ...change, confirmed: false }), context)).status, 400);
  assert.equal((await follow.POST(request(change), context)).status, 200);
  assert.equal(db.records.get(`crm_contact_preferences/${convId}`).status, 'revoked');
  assert.equal([...db.records.keys()].filter(key => key.includes('/events/')).length, 1);
  assert.equal((await follow.POST(request({ ...change, status: 'granted' }), context)).status, 409);
  const result = await (await follow.GET(new Request(`https://test.invalid?taskId=${taskId}`), context)).json();
  assert.equal(result.permission.status, 'revoked'); assert.equal(result.windowOpen, false); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_NOTES|PRIVATE_SOURCE|PRIVATE_PHONE/);
}));
test('approved templates can be reviewed and sent outside 24 hours exactly once', () => isolated(async () => {
  const db = database(); globalThis.__followAuth = { ok: true, uid: 'admin', adminDb: db }; let sends = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/message_templates')) { assert.equal(new URL(url).pathname, '/v26.0/100/message_templates'); return Response.json({ data: [rawTemplate] }); }
    sends++; const payload = JSON.parse(init.body); assert.equal(payload.type, 'template'); assert.equal(payload.to, '77001234567'); assert.deepEqual(payload.template.components[0].parameters, [{ type: 'text', text: 'Роман' }, { type: 'text', text: 'HL-77' }]); return Response.json({ messages: [{ id: 'wamid.template' }] });
  };
  assert.equal((await follow.POST(request({ ...templateBody, reviewedText: 'Tampered' }), context)).status, 409);
  const results = await Promise.all([follow.POST(request(templateBody), context), follow.POST(request(templateBody), context)]);
  assert.ok(results.every(result => result.status === 200)); assert.equal(sends, 1);
  const task = db.records.get(`crm_followups/${taskId}`); assert.ok(task.lastFollowupSentAt); assert.equal(task.status, 'open'); assert.notEqual(task.revision, 'r1');
  assert.equal((await (await follow.POST(request(templateBody), context)).json()).state, 'accepted'); assert.equal(sends, 1);
  assert.equal((await follow.POST(request({ ...templateBody, requestId: randomUUID(), followupRevision: task.revision }), context)).status, 409);
  assert.equal(sends, 1);
}));
test('revoked permission, closed task, wrong recipient and changed approval block template sends', () => isolated(async () => {
  let sends = 0; globalThis.fetch = async url => { if (String(url).includes('/message_templates')) return Response.json({ data: [rawTemplate] }); sends++; throw new Error('Must not send'); };
  for (const change of ['permission', 'task', 'recipient', 'review']) {
    const db = database(); globalThis.__followAuth = { ok: true, uid: 'admin', adminDb: db };
    if (change === 'permission') db.records.get(`crm_contact_preferences/${convId}`).status = 'revoked';
    if (change === 'task') db.records.get(`crm_followups/${taskId}`).status = 'completed';
    const result = await follow.POST(request(change === 'recipient' ? { ...templateBody, reviewedRecipient: '77009999999' } : change === 'review' ? { ...templateBody, templateRevision: 'f'.repeat(64) } : templateBody), context);
    assert.equal(result.status, 409);
  }
  const db = database(); globalThis.__followAuth = { ok: true, uid: 'admin', adminDb: db };
  db.afterTransaction = () => { db.records.get(`crm_contact_preferences/${convId}`).status = 'revoked'; };
  assert.equal((await (await follow.POST(request(templateBody), context)).json()).state, 'rejected'); assert.equal(sends, 0);
  assert.equal(db.records.get(`whatsapp_conversations/${convId}`).pendingSendId, null);
}));
test('template timeouts lock the conversation and retries never call Meta again', () => isolated(async () => {
  const db = database(); globalThis.__followAuth = { ok: true, uid: 'admin', adminDb: db }; let sends = 0;
  globalThis.fetch = async url => { if (String(url).includes('/message_templates')) return Response.json({ data: [rawTemplate] }); sends++; throw new Error('private upstream error'); };
  assert.equal((await (await follow.POST(request(templateBody), context)).json()).state, 'unknown');
  assert.equal((await (await follow.POST(request(templateBody), context)).json()).state, 'unknown'); assert.equal(sends, 1);
  assert.equal((await follow.POST(request({ ...templateBody, requestId: randomUUID() }), context)).status, 409); assert.equal(sends, 1);
}));
test('AI follow-up drafts exclude internal CRM notes and verify the task again after generation', () => isolated(async () => {
  const db = database({ recent: true }); globalThis.__followAuth = { ok: true, uid: 'admin', adminDb: db }; let calls = 0;
  const draft = { action: 'draft', language: 'ru', followupId: taskId, followupRevision: 'r1' };
  globalThis.fetch = async (url, init) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses'); const provider = JSON.parse(init.body); assert.equal(provider.store, false); assert.equal(provider.text.format.strict, true);
    assert.deepEqual(JSON.parse(provider.input).followup, { kind: 'offer', offerNumber: 'HL-77' }); assert.doesNotMatch(provider.input, /PRIVATE_|99999|77001234567/);
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"reply":"Здравствуйте! Ваш запрос ещё актуален?"}' }] }] });
  };
  const prepared = await (await reply.POST(request(draft), context)).json(); assert.equal(prepared.followupRevision, 'r1'); assert.equal(calls, 1);
  const changed = database({ recent: true }); globalThis.__followAuth.adminDb = changed;
  globalThis.fetch = async () => { changed.records.get(`crm_followups/${taskId}`).status = 'cancelled'; return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"reply":"stale"}' }] }] }); };
  assert.equal((await reply.POST(request(draft), context)).status, 409);
}));
test('ordinary text follow-ups require consent and record the accepted message on the task', () => isolated(async () => {
  const db = database({ recent: true }); globalThis.__followAuth = { ok: true, uid: 'admin', adminDb: db }; let sends = 0;
  const body = { action: 'send', text: 'Ваш запрос ещё актуален?', reviewed: true, requestId: randomUUID(), baseIncomingAt: now, baseRevision: String(now), followupId: taskId, followupRevision: 'r1' };
  globalThis.fetch = async () => { sends++; return Response.json({ messages: [{ id: 'wamid.followup' }] }); };
  db.records.get(`crm_contact_preferences/${convId}`).status = 'revoked';
  assert.equal((await reply.POST(request(body), context)).status, 409); assert.equal(sends, 0);
  db.records.get(`crm_contact_preferences/${convId}`).status = 'granted';
  assert.equal((await (await reply.POST(request(body), context)).json()).state, 'accepted'); assert.equal(sends, 1);
  assert.ok(db.records.get(`crm_followups/${taskId}`).lastFollowupSentAt);
  assert.equal((await (await reply.POST(request(body), context)).json()).state, 'accepted'); assert.equal(sends, 1);
}));
