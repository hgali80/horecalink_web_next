import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const core = new URL('../app/lib/socialPublishing.mjs', import.meta.url).href;
const images = new URL('../app/lib/productImageNames.mjs', import.meta.url).href;
const source = (await readFile(new URL('../app/lib/server/socialPublishing.js', import.meta.url), 'utf8'))
  .replace("import 'server-only';", '')
  .replace("from '../socialPublishing.mjs'", `from '${core}'`)
  .replace("from '../productImageNames.mjs'", `from '${images}'`)
  .replace("import { getAdminServices } from './firebaseAdmin';", "const getAdminServices = () => ({ adminStorage: { bucket: () => ({ file: () => ({ getMetadata: async () => [{ generation: '1' }] }) }) } });");
const { createPost, transitionPost, saveSettings } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

class DB {
  constructor(records = {}) { this.records = new Map(Object.entries(records)); this.queue = Promise.resolve(); this.counter = 0; }
  collection(name) {
    return { doc: (id = `generated-${++this.counter}`) => ({ key: `${name}/${id}`, id }) };
  }
  runTransaction(fn) {
    const run = this.queue.then(async () => {
      const writes = []; let writing = false;
      const tx = {
        get: async ref => { assert.equal(writing, false, 'Firestore transactions require all reads before writes'); const value = this.records.get(ref.key); return { ref, id: ref.id, exists: value !== undefined, data: () => structuredClone(value) }; },
        create: (ref, value) => { writing = true; writes.push(() => { assert.equal(this.records.has(ref.key), false, 'duplicate record'); this.records.set(ref.key, structuredClone(value)); }); },
        set: (ref, value) => { writing = true; writes.push(() => this.records.set(ref.key, structuredClone(value))); },
        update: (ref, value) => { writing = true; writes.push(() => { assert.ok(this.records.has(ref.key)); this.records.set(ref.key, { ...this.records.get(ref.key), ...structuredClone(value) }); }); },
      };
      const result = await fn(tx);
      for (const write of writes) write();
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
const product = { active: true, sku: 'sku', name_ru: 'Product', price: 100, image_names: ['photo.jpg'] };
const body = () => ({ productId: 'p1', channels: ['instagram', 'facebook'], scheduledAt: new Date(Date.now() + 3600000).toISOString(), captions: {}, media: {} });
test('manual draft has no jobs until one revision-specific approval; concurrent approval does not duplicate', async () => {
  const db = new DB({ 'products/p1': product });
  const id = await createPost(db, body(), 'admin');
  assert.equal([...db.records.keys()].filter(k => k.startsWith('social_publish_jobs/')).length, 0);
  assert.equal(db.records.get(`social_posts/${id}`).status, 'pending_approval');
  const results = await Promise.allSettled([transitionPost(db, id, { action: 'approve', revision: 1 }, 'admin'), transitionPost(db, id, { action: 'approve', revision: 1 }, 'admin')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal([...db.records.keys()].filter(k => k.startsWith('social_publish_jobs/')).length, 2);
  const post = db.records.get(`social_posts/${id}`);
  assert.equal(post.approvedHash, post.contentHash);
});
test('cancel is atomic and refuses a started channel; stale revisions cannot approve', async () => {
  const db = new DB({ 'products/p1': product });
  const id = await createPost(db, body(), 'admin');
  await assert.rejects(transitionPost(db, id, { action: 'approve', revision: 0 }, 'admin'), /değişti/);
  await transitionPost(db, id, { action: 'approve', revision: 1 }, 'admin');
  const key = `social_publish_jobs/${id}_1_instagram`;
  db.records.get(key).status = 'publishing';
  await assert.rejects(transitionPost(db, id, { action: 'cancel', revision: 1 }, 'admin'), /Başlamış/);
  assert.equal(db.records.get(`social_posts/${id}`).status, 'scheduled');
  db.records.get(key).status = 'queued';
  await transitionPost(db, id, { action: 'cancel', revision: 1 }, 'admin');
  assert.equal(db.records.get(key).status, 'cancelled');
  assert.equal(db.records.get(`social_publish_jobs/${id}_1_facebook`).status, 'cancelled');
});
test('automatic mode schedules only new drafts; existing pending draft stays pending', async () => {
  const db = new DB({ 'products/p1': product });
  const manual = await createPost(db, body(), 'admin');
  await saveSettings(db, { mode: 'automatic', paused: true }, 'admin');
  const automatic = await createPost(db, body(), 'admin');
  assert.equal(db.records.get(`social_posts/${manual}`).status, 'pending_approval');
  assert.equal(db.records.get(`social_posts/${automatic}`).status, 'scheduled');
  assert.equal(db.records.get('social_settings/global').paused, true);
});
test('cross-product/channel custom asset is rejected without creating a post', async () => {
  const db = new DB({ 'products/p1': product, 'social_media_assets/asset': { productId: 'p2', channel: 'instagram', status: 'ready' } });
  const draft = body(); draft.media.instagram = { source: 'custom', assetId: 'asset' };
  await assert.rejects(createPost(db, draft, 'admin'), /ait değil/);
  assert.equal([...db.records.keys()].filter(k => k.startsWith('social_posts/')).length, 0);
});
