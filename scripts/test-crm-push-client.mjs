import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = (await readFile(new URL('../app/lib/crmPushClient.js', import.meta.url), 'utf8'))
  .replace("import { app, auth } from '@/firebase/index';", 'const {app,auth} = globalThis.__pushClientFixture;')
  .replaceAll("import('firebase/messaging')", 'Promise.resolve(globalThis.__pushClientFixture.sdk)');
const token = 'test_token_'.repeat(12), hash = value => createHash('sha256').update(value).digest('hex');
async function fixture(callback) {
  const storage = new Map(), server = new Map(), original = new Map();
  const state = { app: {}, auth: { currentUser: { uid: 'operator', getIdToken: async () => 'fake-auth' } }, shown: [], unsubscribed: 0, listener: null, postWait: null };
  const registration = { active: {}, pushManager: { getSubscription: async () => ({ unsubscribe: async () => { state.unsubscribed++; } }) }, unregister: async () => true,
    showNotification: async (...args) => { if (state.throwShow) throw new Error('Permission withdrawn'); state.shown.push(args); } };
  state.sdk = { isSupported: async () => true, getMessaging: () => ({}), getToken: async () => token, deleteToken: async () => true, onMessage: (_, handler) => { state.listener = handler; return () => { state.listener = null; }; } };
  const notification = { permission: 'granted', requestPermission: async () => 'granted' };
  const globals = { __pushClientFixture: state, window: { Notification: notification }, Notification: notification,
    navigator: { serviceWorker: { register: async () => registration, getRegistration: async () => registration } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (_, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      if (options.method === 'POST') { if (state.postWait) await state.postWait; const id = hash(body.token); server.set(id, body.token); return Response.json({ ok: true, id }); }
      if (options.method === 'DELETE') { server.delete(body.id); return Response.json({ ok: true }); }
      return Response.json({ enabled: true, vapidKey: 'public-test-key' });
    } };
  try {
    for (const [key, value] of Object.entries(globals)) { original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true }); }
    const api = await import(`data:text/javascript;base64,${Buffer.from(source + `\n//${Math.random()}`).toString('base64')}`);
    await callback({ api, state, storage, server });
  } finally { for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}
test('browser opt-in stores only token hash and opt-out clears both local and server registration', () => fixture(async ({ api, storage, server, state }) => {
  await api.enableCrmPush(); assert.equal(server.size, 1); assert.equal(api.savedCrmPush().id, hash(token)); assert.doesNotMatch(JSON.stringify([...storage.values()]), /test_token/);
  await api.disableCrmPush(); assert.equal(server.size, 0); assert.equal(api.savedCrmPush(), null); assert.ok(state.unsubscribed);
}));
test('opting out while Firebase obtains the token cannot re-enable notifications', () => fixture(async ({ api, state, server }) => {
  let release; state.sdk.getToken = () => new Promise(resolve => { release = resolve; });
  const pending = api.enableCrmPush(), rejection = assert.rejects(pending, /iptal/);
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  await api.disableCrmPush(); release(token); await rejection;
  assert.equal(server.size, 0); assert.equal(api.savedCrmPush(), null);
}));
test('a late registration response is removed after the operator has already opted out', () => fixture(async ({ api, state, server }) => {
  let release; state.postWait = new Promise(resolve => { release = resolve; });
  const pending = api.enableCrmPush(), rejection = assert.rejects(pending, /iptal/);
  while (!api.savedCrmPush()) await new Promise(resolve => setTimeout(resolve, 0));
  await api.disableCrmPush(); release(); await rejection;
  assert.equal(server.size, 0); assert.equal(api.savedCrmPush(), null);
}));
test('foreground push ignores another operator and handles browser permission withdrawal', () => fixture(async ({ api, state }) => {
  let refreshed = 0; const stop = await api.listenCrmPush(() => { refreshed++; });
  await state.listener({ data: { type: 'crm_due', ownerHash: hash('other'), notificationId: 'test' } }); assert.equal(refreshed, 0);
  await state.listener({ data: { type: 'crm_due', ownerHash: hash('operator'), notificationId: 'test' } }); assert.equal(refreshed, 1); assert.equal(state.shown.length, 1);
  state.throwShow = true;
  await state.listener({ data: { type: 'crm_due', ownerHash: hash('operator'), notificationId: 'test' } }); assert.equal(refreshed, 2); stop();
}));
