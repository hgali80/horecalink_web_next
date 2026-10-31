import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productFacts } from '../app/lib/socialPublishing.mjs';

const core = new URL('../app/lib/socialPublishing.mjs', import.meta.url).href;
const images = new URL('../app/lib/productImageNames.mjs', import.meta.url).href;
const source = (await readFile(new URL('../app/lib/server/socialWorker.js', import.meta.url), 'utf8'))
  .replace("import 'server-only';", '')
  .replace("from '../socialPublishing.mjs'", `from '${core}'`)
  .replace("from '../productImageNames.mjs'", `from '${images}'`)
  .replace("import { FieldValue } from 'firebase-admin/firestore';", 'const FieldValue = { delete: () => null };')
  .replace("import sharp from 'sharp';", "const sharp = () => ({ rotate() { return this; }, resize() { return this; }, jpeg() { return this; }, toBuffer: async () => Buffer.from('photo') });")
  .replace("import { getAdminServices } from './firebaseAdmin';", 'const getAdminServices = () => { throw new Error("Use test services"); };')
  .replace("import { addLog, newOwner, digest } from './socialPublishing';", "const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex'); let owners = 0; const newOwner = () => String(++owners); const addLog = () => {};")
  .replace("import { publishSocial } from './socialMeta.mjs';", 'const publishSocial = (...args) => globalThis.__socialWorkerTest.publish(...args);')
  .replace("import { syncWhatsAppProduct } from './whatsappCatalog';", 'const syncWhatsAppProduct = async () => { throw new Error("Unexpected WhatsApp mutation"); };')
  .replace("import { revalidatePublicProductPages } from './productPageCache';", 'const revalidatePublicProductPages = () => {};');
const { processSocialJobs, authorizedWorker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
class DB {
  constructor(records) { this.records = new Map(Object.entries(records)); this.queue = Promise.resolve(); }
  snapshot(key) { const data = this.records.get(key); return { id: key.split('/')[1], ref: this.ref(key), exists: data !== undefined, data: () => structuredClone(data) }; }
  ref(key) { return { key, get: async () => this.snapshot(key), update: async data => this.records.set(key, { ...this.records.get(key), ...data }) }; }
  collection(name) {
    const query = (filters = [], sort, count = Infinity) => ({
      where: (field, op, value) => query([...filters, { field, op, value }], sort, count),
      orderBy: field => query(filters, field, count), limit: n => query(filters, sort, n),
      get: async () => ({ docs: [...this.records].filter(([key, data]) => key.startsWith(`${name}/`) && filters.every(f => f.op === '==' ? data[f.field] === f.value : f.op === '<=' ? data[f.field] <= f.value : data[f.field] < f.value)).sort((a, b) => sort ? a[1][sort] - b[1][sort] : 0).slice(0, count).map(([key]) => this.snapshot(key)) }),
    });
    return { ...query(), doc: id => this.ref(`${name}/${id}`) };
  }
  runTransaction(fn) {
    const run = this.queue.then(async () => {
      const writes = []; let writing = false;
      const result = await fn({ get: ref => { assert.equal(writing, false); return ref.get(); }, update: (ref, data) => { writing = true; writes.push(() => ref.update(data)); } });
      for (const write of writes) await write();
      return result;
    });
    this.queue = run.catch(() => {}); return run;
  }
}
const product = { active: true, sku: 'sku', name: 'Product', image_names: ['image.jpg'] };
function setup(publish) {
  const db = new DB({
    'social_settings/global': { paused: false, mode: 'approval' }, 'products/p1': product,
    'social_posts/post': { productId: 'p1', product: productFacts(product, 'p1'), revision: 1, approvedRevision: 1, contentHash: 'h', approvedHash: 'h', status: 'scheduled', captions: { instagram: 'Text', facebook: 'Text' }, media: { instagram: { source: 'web', imageNames: ['image.jpg'], generations: ['1'] }, facebook: { source: 'web', imageNames: ['image.jpg'], generations: ['1'] } } },
    'social_publish_jobs/job': { postId: 'post', productId: 'p1', revision: 1, channel: 'instagram', status: 'queued', nextAttemptAt: Date.now() - 1000, attempts: 0 },
  });
  const calls = [];
  globalThis.__socialWorkerTest = { publish: async (...args) => { calls.push(args); return publish(...args); } };
  const services = { adminDb: db, adminStorage: { bucket: () => ({ file: () => ({ getMetadata: async () => [{ generation: '1' }], download: async () => [Buffer.from('photo')], save: async () => {}, getSignedUrl: async () => ['https://example.com/image'] }) }) } };
  return { db, calls, services };
}
const enabled = process.env.SOCIAL_PUBLISHING_ENABLED;
test.before(() => { process.env.SOCIAL_PUBLISHING_ENABLED = 'true'; });
test.after(() => { if (enabled === undefined) delete process.env.SOCIAL_PUBLISHING_ENABLED; else process.env.SOCIAL_PUBLISHING_ENABLED = enabled; });
test('two concurrent workers only publish a channel once', async () => {
  let release, started;
  const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { started = resolve; });
  const { db, calls, services } = setup(async () => { started(); await gate; return { status: 'published', remoteId: 'remote' }; });
  const first = processSocialJobs(services); await ready;
  await processSocialJobs(services);
  assert.equal(calls.length, 1); release(); await first;
  assert.equal(db.records.get('social_publish_jobs/job').status, 'published');
  assert.equal(db.records.get('social_posts/post').status, 'published');
});
test('ambiguous result and expired leases require review without reposting', async () => {
  const { db, calls, services } = setup(async () => { throw new Error('secret-bearing-network-error'); });
  await processSocialJobs(services); await processSocialJobs(services);
  assert.equal(calls.length, 1);
  assert.equal(db.records.get('social_publish_jobs/job').error, 'PUBLICATION_RESULT_UNKNOWN');
  db.records.get('social_publish_jobs/job').status = 'publishing'; db.records.get('social_publish_jobs/job').leaseUntil = 1;
  await processSocialJobs(services);
  assert.equal(calls.length, 1); assert.equal(db.records.get('social_publish_jobs/job').status, 'needs_review');
});
test('changed product prevents publication and a completed channel is not sent again', async () => {
  const { db, calls, services } = setup(async () => ({ status: 'published', remoteId: 'remote' }));
  db.records.get('products/p1').price = 100;
  await processSocialJobs(services);
  assert.equal(calls.length, 0); assert.equal(db.records.get('social_publish_jobs/job').error, 'PRODUCT_CHANGED');
  db.records.set('social_publish_jobs/completed', { ...db.records.get('social_publish_jobs/job'), channel: 'facebook', status: 'published' });
  await processSocialJobs(services); assert.equal(calls.length, 0);
});
test('scheduler rejects missing/incorrect credentials', () => {
  const previous = process.env.SOCIAL_CRON_SECRET;
  try { process.env.SOCIAL_CRON_SECRET = 'x'.repeat(32); assert.equal(authorizedWorker(new Request('https://example.com')), false); assert.equal(authorizedWorker(new Request('https://example.com', { headers: { Authorization: `Bearer ${'x'.repeat(32)}` } })), true); }
  finally { if (previous === undefined) delete process.env.SOCIAL_CRON_SECRET; else process.env.SOCIAL_CRON_SECRET = previous; }
});
