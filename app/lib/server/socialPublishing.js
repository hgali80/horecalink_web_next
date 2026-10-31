import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS, normalizeDraft, invalid, validId, productFacts } from '../socialPublishing.mjs';
import { getStoredProductImageNames } from '../productImageNames.mjs';
import { getAdminServices } from './firebaseAdmin';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const jobId = (postId, revision, channel) => `${postId}_${revision}_${channel}`;
export function addLog(tx, db, postId, action, uid, details = {}) {
  tx.create(db.collection('social_publish_logs').doc(), { postId, action, actor: uid, at: Date.now(), ...details });
}
export async function settings(db) { return { ...DEFAULT_SETTINGS, ...(await db.collection('social_settings').doc('global').get()).data() }; }
export async function createPost(db, body, uid) {
  const draft = normalizeDraft(body);
  const ref = db.collection('social_posts').doc();
  await db.runTransaction(async tx => {
    const productSnap = await tx.get(db.collection('products').doc(draft.productId));
    const global = { ...DEFAULT_SETTINGS, ...(await tx.get(db.collection('social_settings').doc('global'))).data() };
    if (!productSnap.exists) throw invalid('Ürün bulunamadı.', 404);
    const product = productSnap.data();
    if (product.active !== true) throw invalid('Pasif ürün için yayın hazırlanamaz.', 409);
    const images = getStoredProductImageNames(product);
    const selections = {};
    for (const channel of draft.channels) {
      if (draft.media[channel].source === 'custom') {
        const asset = (await tx.get(db.collection('social_media_assets').doc(draft.media[channel].assetId))).data();
        if (!asset || asset.productId !== draft.productId || asset.channel !== channel || asset.status !== 'ready') throw invalid('Görsel bu ürün ve kanala ait değil.');
        selections[channel] = { ...draft.media[channel], storagePath: asset.storagePath, hash: asset.hash };
      } else {
        if (!images.length || images.some(name => /[/\\\u0000-\u001f]/.test(name))) throw invalid('Ürüne önce web görseli ekleyin.');
        const { adminStorage } = getAdminServices();
        const generations = await Promise.all(images.map(async name => {
          const [metadata] = await adminStorage.bucket().file(`product_images/${name}`).getMetadata();
          return String(metadata.generation);
        }));
        selections[channel] = { source: 'web', imageNames: images, generations };
      }
    }
    const facts = productFacts(product, draft.productId);
    const snapshot = { ...draft, displayName: draft.displayName || facts.name, media: selections, product: facts };
    const contentHash = digest(snapshot);
    const automatic = global.mode === 'automatic';
    const post = { ...snapshot, contentHash, revision: 1, status: automatic ? 'scheduled' : 'pending_approval', createdBy: uid, createdAt: Date.now(), updatedAt: Date.now(), approvedRevision: automatic ? 1 : null, approvedHash: automatic ? contentHash : null, approvedBy: automatic ? uid : null, approvalMode: automatic ? 'automatic' : null };
    tx.create(ref, post);
    if (automatic) createJobs(tx, db, ref.id, post);
    addLog(tx, db, ref.id, automatic ? 'automatically_scheduled' : 'submitted', uid);
  });
  return ref.id;
}
function createJobs(tx, db, id, post) {
  for (const channel of post.channels) tx.create(db.collection('social_publish_jobs').doc(jobId(id, post.revision, channel)), { postId: id, productId: post.productId, channel, revision: post.revision, status: 'queued', nextAttemptAt: post.scheduledAt, createdAt: Date.now(), attempts: 0 });
}
export async function transitionPost(db, id, body, uid) {
  if (!validId(id) || !['approve', 'cancel'].includes(body.action) || !Number.isInteger(body.revision)) throw invalid('İşlem geçersiz.');
  await db.runTransaction(async tx => {
    const ref = db.collection('social_posts').doc(id), snap = await tx.get(ref);
    if (!snap.exists) throw invalid('Yayın bulunamadı.', 404);
    const post = snap.data();
    if (post.revision !== body.revision) throw invalid('Yayın değişti; yenileyin.', 409);
    if (body.action === 'approve') {
      if (post.status !== 'pending_approval') throw invalid('Yayın onay beklemiyor.', 409);
      const product = await tx.get(db.collection('products').doc(post.productId));
      if (!product.exists) throw invalid('Ürün silinmiş.', 409);
      tx.update(ref, { status: 'scheduled', approvedRevision: post.revision, approvedHash: post.contentHash, approvedBy: uid, approvedAt: Date.now(), approvalMode: 'approval', updatedAt: Date.now() });
      createJobs(tx, db, id, post);
    } else {
      if (!['pending_approval', 'scheduled'].includes(post.status)) throw invalid('Bu yayın iptal edilemiyor.', 409);
      const jobs = await Promise.all(post.channels.map(channel => tx.get(db.collection('social_publish_jobs').doc(jobId(id, post.revision, channel)))));
      if (jobs.some(job => job.exists && ['publishing', 'published', 'needs_review'].includes(job.data().status))) throw invalid('Başlamış yayın iptal edilemez; kanal durumlarını kontrol edin.', 409);
      for (const job of jobs) if (job.exists) tx.update(job.ref, { status: 'cancelled', updatedAt: Date.now() });
      tx.update(ref, { status: 'cancelled', updatedAt: Date.now() });
    }
    addLog(tx, db, id, body.action, uid);
  });
}
export async function saveSettings(db, body, uid) {
  if (!['approval', 'automatic'].includes(body.mode) || typeof body.paused !== 'boolean') throw invalid('Ayarlar geçersiz.');
  await db.runTransaction(async tx => {
    tx.set(db.collection('social_settings').doc('global'), { mode: body.mode, paused: body.paused, timezone: 'Asia/Almaty', updatedBy: uid, updatedAt: Date.now() });
    addLog(tx, db, '', 'settings_updated', uid, { mode: body.mode, paused: body.paused });
  });
}
export function connectionConfig() {
  return { tokenConfigured: !!process.env.META_SOCIAL_ACCESS_TOKEN, pageConfigured: !!process.env.META_SOCIAL_PAGE_ID, instagramConfigured: !!process.env.META_SOCIAL_INSTAGRAM_ID, workerEnabled: process.env.SOCIAL_PUBLISHING_ENABLED === 'true', aiConfigured: !!process.env.OPENAI_API_KEY };
}
export const newOwner = () => randomUUID();
