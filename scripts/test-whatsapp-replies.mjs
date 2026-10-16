import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertSendable, parseDraft, safeSendDiagnostics, validateReply } from '../app/lib/server/whatsappReplyCore.mjs';

import { formatSendRejection } from '../app/lib/whatsappSendFeedback.mjs';

const now = Date.now();
const conversationId = 'a'.repeat(64);
const baseConversation = () => ({ senderId: '77001234567', phoneNumberId: '200', lastIncomingAt: new Date(now) });
test('send requires human review, bounded text and a matching recent incoming message', () => {
  const valid = { action: 'send', text: 'Hello', reviewed: true, baseIncomingAt: now, baseRevision: String(now), requestId: '11111111-1111-4111-8111-111111111111' };
  assert.equal(validateReply(valid), valid);
  for (const change of [{ reviewed: false }, { text: '' }, { text: 'x'.repeat(4097) }, { requestId: '../bad' }, { baseIncomingAt: '123' }]) assert.throws(() => validateReply({ ...valid, ...change }));
  assertSendable(baseConversation(), now, '200', now + 1000);
  for (const [conversation, base, phone, time] of [
    [baseConversation(), now - 1, '200', now], [baseConversation(), now, '201', now],
    [baseConversation(), now, '200', now + 86400000], [baseConversation(), now, '200', now - 1],
    [{ ...baseConversation(), pendingSendId: 'pending' }, now, '200', now],
  ]) assert.throws(() => assertSendable(conversation, base, phone, time));
});
test('incomplete, refused and malformed model outputs are never usable drafts', () => {
  const output = text => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text }] }] });
  assert.equal(parseDraft(output('{"reply":"Здравствуйте"}')), 'Здравствуйте');
  for (const value of [{ status: 'incomplete' }, { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }, output('not JSON'), output('{"reply":""}')]) assert.throws(() => parseDraft(value));
});

function database() {
  const records = new Map([[`whatsapp_conversations/${conversationId}`, baseConversation()]]);
  const doc = path => ({ path, get: async () => ({ exists: records.has(path), data: () => records.get(path) }), collection: name => collection(`${path}/${name}`) });
  const collection = path => ({ doc: id => doc(`${path}/${id}`), orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [{ data: () => ({ type: 'text', text: 'Need a quote' }) }] }) }) }) });
  let tail = Promise.resolve();
  return { records, collection, runTransaction: callback => {
    const work = tail.then(async () => {
      let writing = false;
      const writes = [];
      const result = await callback({ get: async ref => { assert.equal(writing, false); return ref.get(); },
        create: (ref, data) => { writing = true; assert.equal(records.has(ref.path), false); writes.push(() => records.set(ref.path, data)); },
        set: (ref, data) => { writing = true; writes.push(() => records.set(ref.path, data)); },
        update: (ref, data) => { writing = true; writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...data })); },
      });
      writes.forEach(write => write()); return result;
    });
    tail = work.catch(() => {}); return work;
  } };
}

const source = (await readFile(new URL('../app/api/admin/whatsapp/conversations/[conversationId]/reply/route.js', import.meta.url), 'utf8'))
  .replace("import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';", 'const authorizeWhatsAppRequest = async () => globalThis.__replyAuth; const inboxJson = (body,status=200) => Response.json(body,{status});')
  .replace("'@/app/lib/server/whatsappInboxCore.mjs'", JSON.stringify(new URL('../app/lib/server/whatsappInboxCore.mjs', import.meta.url).href))
  .replace("'@/app/lib/server/whatsappReplyCore.mjs'", JSON.stringify(new URL('../app/lib/server/whatsappReplyCore.mjs', import.meta.url).href));
const route = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('actual reply route gates authorization, claims sends atomically and never retries ambiguous sends', async () => {
  const originalFetch = globalThis.fetch;
  const envKeys = ['WHATSAPP_SEND_ENABLED','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_API_VERSION','WHATSAPP_DRAFTS_ENABLED','OPENAI_API_KEY','OPENAI_MODEL'];
  const saved = envKeys.map(key => [key,process.env[key]]);
  const request = body => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(body) });
  const context = { params: Promise.resolve({ conversationId }) };
  const body = { action: 'send', text: 'Reviewed response', reviewed: true, baseIncomingAt: now, baseRevision: String(now), requestId: '11111111-1111-4111-8111-111111111111' };
  let calls = 0;
  try {
    globalThis.__replyAuth = { ok: false, response: Response.json({}, { status: 403 }) };
    assert.equal((await route.POST(request(body), context)).status, 403);
    const db = database();
    globalThis.__replyAuth = { ok: true, uid: 'admin', adminDb: db };
    delete process.env.WHATSAPP_SEND_ENABLED;
    assert.equal((await route.POST(request(body), context)).status, 503);
    Object.assign(process.env, { WHATSAPP_SEND_ENABLED:'true', WHATSAPP_ACCESS_TOKEN:'fake', WHATSAPP_PHONE_NUMBER_ID:'200', WHATSAPP_GRAPH_API_VERSION:'v26.0' });
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://graph.facebook.com/v26.0/200/messages');
      assert.equal(JSON.parse(options.body).to, '77001234567');
      return Response.json({ messages: [{ id: 'wamid.test' }] });
    };
    const results = await Promise.all([route.POST(request({ ...body, to:'attacker' }), context), route.POST(request(body), context)]);
    assert.equal(calls, 1); assert.ok(results.every(result => result.status === 200));
    assert.equal([...db.records.values()].filter(value => value.sendState === 'accepted').length, 1);
    const second = { ...body, requestId:'22222222-2222-4222-8222-222222222222' };
    globalThis.fetch = async () => { calls++; throw new Error('upstream secret must stay private'); };
    assert.equal((await (await route.POST(request(second),context)).json()).state, 'unknown');
    const retry = await route.POST(request(second),context);
    assert.equal((await retry.json()).state, 'unknown'); assert.equal(calls,2);
    assert.equal((await route.POST(request({ ...second, requestId:'33333333-3333-4333-8333-333333333333' }), context)).status,409);
    assert.equal((await route.POST(request({ ...body, text:'changed' }),context)).status,409);
    assert.equal(calls,2);
    globalThis.__replyAuth = { ok:true, uid:'admin', adminDb:database() };
    assert.equal((await route.POST(request({ ...body, baseIncomingAt:now-1 }),context)).status,409);
    const changedDb=database();
    changedDb.records.get(`whatsapp_conversations/${conversationId}`).lastIncomingRevision='b'.repeat(64);
    globalThis.__replyAuth={ok:true,uid:'admin',adminDb:changedDb};
    assert.equal((await route.POST(request(body),context)).status,409);
    // A definite rejection is persisted; retrying the same request never calls Meta again.
    globalThis.__replyAuth={ok:true,uid:'admin',adminDb:database()};
    let rejectionCalls=0;
    globalThis.fetch=async () => { rejectionCalls++; return Response.json({error:{code:190,error_subcode:463,message:'SECRET_TOKEN'}},{status:401}); };
    const rejection=await route.POST(request(body),context);
    const rejectionBody=await rejection.json();
    assert.equal(rejectionBody.state,'rejected');
    assert.deepEqual(rejectionBody.diagnostics,{httpStatus:401,code:190,subcode:463});
    assert.doesNotMatch(JSON.stringify(rejectionBody),/SECRET_TOKEN/);
    const same=await (await route.POST(request(body),context)).json();
    assert.deepEqual(same.diagnostics,rejectionBody.diagnostics); assert.equal(rejectionCalls,1);
    assert.equal(globalThis.__replyAuth.adminDb.records.get(`whatsapp_conversations/${conversationId}`).pendingSendId,null);
    Object.assign(process.env,{WHATSAPP_DRAFTS_ENABLED:'true',OPENAI_API_KEY:'fake',OPENAI_MODEL:'configured-model'});
    globalThis.fetch = async (url,options) => {
      assert.equal(url,'https://api.openai.com/v1/responses');
      const payload=JSON.parse(options.body);
      assert.equal(payload.store,false); assert.equal(payload.text.format.strict,true);
      assert.doesNotMatch(payload.input,/77001234567/);
      return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'{"reply":"Здравствуйте!"}'}]}]});
    };
    assert.equal((await (await route.POST(request({action:'draft',language:'ru'}),context)).json()).text,'Здравствуйте!');
    assert.equal((await route.POST(request({action:'draft',language:'ru'}),context)).status,429);
  } finally {
    globalThis.fetch=originalFetch; delete globalThis.__replyAuth;
    for (const [key,value] of saved) { if(value===undefined) delete process.env[key]; else process.env[key]=value; }
  }
});

test('Meta diagnostics expose only numeric codes, never provider text or secrets', () => {
  const raw = {code:190,error_subcode:463,message:'SECRET_TOKEN private phone',error_data:{details:'private'}};
  const clean = safeSendDiagnostics(401,raw);
  assert.deepEqual(clean,{httpStatus:401,code:190,subcode:463});
  assert.doesNotMatch(JSON.stringify(clean),/SECRET|private/);
  assert.match(formatSendRejection(clean),/Meta kodu: 190/);
  assert.doesNotMatch(formatSendRejection({code:'SECRET',httpStatus:'private'}),/SECRET|private/);
  assert.deepEqual(safeSendDiagnostics(400,{code:'190',error_subcode:-1}),{httpStatus:400,code:null,subcode:null});
});
