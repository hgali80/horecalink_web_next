import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWhatsAppConnection, subscribeWhatsAppConnection } from '../app/lib/server/whatsappConnectionCore.mjs';

const env = { WHATSAPP_INBOX_ENABLED: 'true', WHATSAPP_APP_SECRET: 'secret-never-expose', WHATSAPP_VERIFY_TOKEN: 'verify-never-expose', WHATSAPP_WABA_ID: '100', WHATSAPP_PHONE_NUMBER_ID: '200', WHATSAPP_APP_ID: '300', WHATSAPP_ACCESS_TOKEN: 'token-never-expose', WHATSAPP_GRAPH_API_VERSION: 'v26.0' };
const provider = (options = {}) => async (url, init) => {
  assert.equal(init.headers.Authorization, `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`);
  assert.equal(init.method, undefined);
  const body = url.includes('subscribed_apps') ? { data: options.apps ?? [{ whatsapp_business_api_data: { id: '300' } }], paging: options.paging }
    : url.includes('phone_numbers') ? { data: [{ id: options.otherAccount ? '999' : '200' }] }
      : { id: '200', display_phone_number: options.phone || '+7 700 444 69 11' };
  return Response.json(body);
};
test('configuration is safe, off by default and never contacts Meta without explicit check', async () => {
  const off = await inspectWhatsAppConnection({}, () => assert.fail('unexpected network'));
  assert.equal(off.enabled, false); assert.equal(off.missing.length, 4);
  const result = await inspectWhatsAppConnection(env, () => assert.fail('unexpected network'));
  assert.equal(result.meta.state, 'unchecked');
  assert.doesNotMatch(JSON.stringify(result), /never-expose/);
});
test('checks real number, account ownership and exact app subscription', async () => {
  const good = await inspectWhatsAppConnection(env, provider(), true);
  assert.equal(good.meta.phoneMatches, true); assert.equal(good.meta.subscribed, true); assert.equal(good.meta.phoneBelongsToAccount, true);
  const bad = await inspectWhatsAppConnection(env, provider({ phone: '+1 555 123 4567', apps: [{ whatsapp_business_api_data: { id: '999' } }], otherAccount: true }), true);
  assert.equal(bad.meta.phoneMatches, false); assert.equal(bad.meta.subscribed, false); assert.equal(bad.meta.phoneBelongsToAccount, false);
  const paged = await inspectWhatsAppConnection(env, provider({ apps: [], paging: { next: 'secret' } }), true);
  assert.equal(paged.meta.subscribed, null); assert.doesNotMatch(JSON.stringify(paged), /secret/);
});
test('provider errors and missing credentials do not leak secrets or claim success', async () => {
  const rejected = await inspectWhatsAppConnection(env, async () => Response.json({ error: { code: 190, error_subcode: 463, message: 'token-never-expose' } }, { status: 400 }), true);
  assert.equal(rejected.meta.diagnostics.code, 190); assert.equal(rejected.meta.diagnostics.subcode, 463);
  assert.doesNotMatch(JSON.stringify(rejected), /never-expose/);
  const failed = await inspectWhatsAppConnection(env, async () => { throw new Error('token-never-expose'); }, true);
  assert.equal(failed.meta.state, 'unavailable'); assert.doesNotMatch(JSON.stringify(failed), /never-expose/);
  const missing = await inspectWhatsAppConnection({ ...env, WHATSAPP_APP_ID: '' }, () => assert.fail('network'), true);
  assert.equal(missing.meta.state, 'missing');
});

test('connection API authorizes before checking Meta or reading stored messages', async () => {
  const { readFile } = await import('node:fs/promises');
  const core = new URL('../app/lib/server/whatsappConnectionCore.mjs', import.meta.url).href;
  const inbox = new URL('../app/lib/server/whatsappInboxCore.mjs', import.meta.url).href;
  const source = (await readFile(new URL('../app/api/admin/whatsapp/connection/route.js', import.meta.url), 'utf8'))
    .replace("import { authorizeWhatsAppRequest, inboxIso, inboxJson } from '@/app/lib/server/whatsappInbox';", "const authorizeWhatsAppRequest = async () => globalThis.__connectionAuth; const inboxIso = () => null; const inboxJson = (value, status = 200) => Response.json(value, {status});")
    .replace("'@/app/lib/server/whatsappConnectionCore.mjs'", JSON.stringify(core))
    .replace("'@/app/lib/server/whatsappInboxCore.mjs'", JSON.stringify(inbox));
  const route = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  try {
    globalThis.__connectionAuth = { ok: false, response: new Response('denied', { status: 403 }) };
    assert.equal((await route.GET(new Request('https://test.invalid?meta=1'))).status, 403);
    globalThis.__connectionAuth.response = new Response('denied', { status: 403 });
    assert.equal((await route.POST(new Request('https://test.invalid', { method: 'POST', body: '{"action":"subscribe"}' }))).status, 403);
    globalThis.__connectionAuth = { ok: true, adminDb: { collection: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) }) } };
    const response = await route.GET(new Request('https://test.invalid'));
    assert.equal(response.status, 200); assert.equal((await response.json()).lastIncomingAt, null);
    assert.equal((await route.POST(new Request('https://test.invalid', { method: 'POST', body: '{"action":"send"}' }))).status, 400);
    assert.equal((await route.POST(new Request('https://test.invalid', { method: 'POST', body: 'bad json' }))).status, 400);
  } finally { delete globalThis.__connectionAuth; }
});

test('subscription verifies app identity, adds only a missing subscription and reads it back', async () => {
  let subscribed = false;
  let posts = 0;
  const network = async (url, init) => {
    if (String(url).includes('debug_token')) return Response.json({ data: { is_valid: true, app_id: '300' } });
    if (init.method === 'POST') { posts++; subscribed = true; return Response.json({ success: true }); }
    return provider({ apps: subscribed ? [{ whatsapp_business_api_data: { id: '300' } }] : [] })(url, init);
  };
  assert.equal((await subscribeWhatsAppConnection(env, network)).meta.subscribed, true);
  assert.equal(posts, 1);
  assert.equal((await subscribeWhatsAppConnection(env, network)).meta.subscribed, true);
  assert.equal(posts, 1);
});

test('subscription fails closed for wrong number, foreign token app and unknown pagination', async () => {
  await assert.rejects(subscribeWhatsAppConnection(env, provider({ phone: '+1 555 123 4567', apps: [] })), /CONNECTION_NOT_READY/);
  await assert.rejects(subscribeWhatsAppConnection(env, provider({ apps: [], paging: { next: 'private' } })), /UNCONFIRMED/);
  let posts = 0;
  await assert.rejects(subscribeWhatsAppConnection(env, async (url, init) => {
    if (init.method === 'POST') posts++;
    if (String(url).includes('debug_token')) return Response.json({ data: { is_valid: true, app_id: '999' } });
    return provider({ apps: [] })(url, init);
  }), /TOKEN_APP_MISMATCH/);
  assert.equal(posts, 0);
});
