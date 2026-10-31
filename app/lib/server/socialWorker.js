import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { canClaim, DEFAULT_SETTINGS, productFacts } from '../socialPublishing.mjs';
import { getAdminServices } from './firebaseAdmin';
import { addLog, newOwner, digest } from './socialPublishing';
import { getStoredProductImageNames } from '../productImageNames.mjs';
import { publishSocial } from './socialMeta.mjs';
import { syncWhatsAppProduct } from './whatsappCatalog';
import { revalidatePublicProductPages } from './productPageCache';

export function authorizedWorker(request) {
  const secret = process.env.SOCIAL_CRON_SECRET;
  const candidate = request.headers.get('authorization') || '';
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(`Bearer ${secret}`), b = Buffer.from(candidate);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function processSocialJobs(services) {
  if (process.env.SOCIAL_PUBLISHING_ENABLED !== 'true') return { paused: true, reason: 'server_disabled' };
  const { adminDb: db, adminStorage } = services || getAdminServices(), bucket = adminStorage.bucket();
  const config = { ...DEFAULT_SETTINGS, ...(await db.collection('social_settings').doc('global').get()).data() };
  if (config.paused) return { paused: true, reason: 'settings_paused' };
  const [due, expired] = await Promise.all([
    db.collection('social_publish_jobs').where('status', '==', 'queued').where('nextAttemptAt', '<=', Date.now()).orderBy('nextAttemptAt').limit(3).get(),
    db.collection('social_publish_jobs').where('status', '==', 'publishing').where('leaseUntil', '<', Date.now()).orderBy('leaseUntil').limit(10).get(),
  ]);
  const candidates = [...expired.docs, ...due.docs];
  let processed = 0;
  for (const candidate of candidates) {
    if (processed >= 3) break;
    const owner = newOwner(), now = Date.now();
    const claimed = await db.runTransaction(async tx => {
      const live = await tx.get(candidate.ref), job = live.data();
      if (!job) return null;
      const postRef = db.collection('social_posts').doc(job.postId), post = (await tx.get(postRef)).data();
      const currentSettings = { ...DEFAULT_SETTINGS, ...(await tx.get(db.collection('social_settings').doc('global'))).data() };
      if (job.status === 'publishing') {
        if (job.leaseUntil < now) { tx.update(live.ref, { status: 'needs_review', error: 'LEASE_EXPIRED_RESULT_UNKNOWN' }); addLog(tx, db, job.postId, 'needs_review', 'worker', { channel: job.channel, code: 'LEASE_EXPIRED_RESULT_UNKNOWN' }); }
        return null;
      }
      if (!post || post.status === 'cancelled') { tx.update(live.ref, { status: 'cancelled' }); return null; }
      if (!canClaim(post, job, currentSettings, now)) return null;
      const product = await tx.get(db.collection('products').doc(job.productId));
      if (!product.exists || product.data().active !== true) { tx.update(live.ref, { status: 'cancelled', error: 'PRODUCT_UNAVAILABLE' }); addLog(tx, db, job.postId, 'cancelled', 'worker', { channel: job.channel, code: 'PRODUCT_UNAVAILABLE' }); return null; }
      if (digest(productFacts(product.data(), job.productId)) !== digest(post.product)
        || (post.media[job.channel].source === 'web' && JSON.stringify(getStoredProductImageNames(product.data())) !== JSON.stringify(post.media[job.channel].imageNames))) {
        tx.update(live.ref, { status: 'needs_review', error: 'PRODUCT_CHANGED' }); addLog(tx, db, job.postId, 'needs_review', 'worker', { channel: job.channel, code: 'PRODUCT_CHANGED' }); return null;
      }
      tx.update(live.ref, { status: 'publishing', owner, leaseUntil: now + 300000, attempts: job.attempts + 1 });
      addLog(tx, db, job.postId, 'started', 'worker', { channel: job.channel });
      return { job: { ...job, attempts: job.attempts + 1 }, post };
    });
    if (!claimed) continue;
    processed++;
    const { job, post } = claimed;
    let outcome;
    try {
      const selection = post.media[job.channel];
      let file = bucket.file(selection.source === 'custom' ? selection.storagePath : `product_images/${selection.imageNames[0]}`);
      if (selection.source === 'custom') {
        const [bytes] = await file.download();
        if (createHash('sha256').update(bytes).digest('hex') !== selection.hash) throw new Error('MEDIA_CHANGED');
      } else {
        for (let index = 0; index < selection.imageNames.length; index++) {
          const [metadata] = await bucket.file(`product_images/${selection.imageNames[index]}`).getMetadata();
          if (String(metadata.generation) !== selection.generations[index]) throw new Error('MEDIA_CHANGED');
        }
        if (['instagram', 'facebook'].includes(job.channel)) {
          // Freeze the approved source generation before giving Meta a URL.
          const source = bucket.file(`product_images/${selection.imageNames[0]}`, { generation: selection.generations[0] });
          const [bytes] = await source.download();
          const photo = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize(1080, 1350, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
          file = bucket.file(`social_media/publish/${candidate.id}.jpg`);
          await file.save(photo, { resumable: false, contentType: 'image/jpeg', metadata: { cacheControl: 'private, max-age=0' } });
        }
      }
      if (job.channel === 'web' || job.channel === 'whatsapp') {
        let names = selection.imageNames;
        if (selection.source === 'custom') {
          const name = `${job.productId}-social-${selection.assetId}.jpg`;
          await file.copy(bucket.file(`product_images/${name}`));
          names = [name];
        }
        await db.collection('products').doc(job.productId).update(job.channel === 'web' ? { webPublished: true, image_names: names } : { whatsappPublished: true, whatsapp_image_names: selection.source === 'custom' ? names : FieldValue.delete() });
        if (job.channel === 'web') revalidatePublicProductPages();
        else await syncWhatsAppProduct(db, job.productId);
        outcome = { status: 'published' };
      } else {
        const [imageUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 6 * 3600000 });
        outcome = await publishSocial(job, post.captions[job.channel], imageUrl, async containerId => {
          await candidate.ref.update({ containerId });
        });
      }
    } catch (error) {
      outcome = { status: 'needs_review', error: /^[A-Z_0-9]{1,80}$/.test(error.message) ? error.message : 'PUBLICATION_RESULT_UNKNOWN' };
    }
    await db.runTransaction(async tx => {
      const live = (await tx.get(candidate.ref)).data();
      if (live?.owner !== owner || live.status !== 'publishing') return;
      const otherJobs = await tx.get(db.collection('social_publish_jobs').where('postId', '==', job.postId));
      const allPublished = otherJobs.docs.every(doc => doc.id === candidate.id ? outcome.status === 'published' : doc.data().status === 'published');
      tx.update(candidate.ref, { ...outcome, owner: null, leaseUntil: 0, updatedAt: Date.now() });
      if (allPublished) tx.update(db.collection('social_posts').doc(job.postId), { status: 'published', updatedAt: Date.now() });
      addLog(tx, db, job.postId, outcome.status, 'worker', { channel: job.channel, ...(outcome.error ? { code: outcome.error } : {}), ...(outcome.remoteId ? { remoteId: outcome.remoteId } : {}) });
    });
  }
  return { processed };
}
