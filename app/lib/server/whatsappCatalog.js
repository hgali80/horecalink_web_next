import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { MetaCatalog } from './metaCatalog.mjs';
import { buildWhatsAppPayload } from './whatsappProductPayload.mjs';
import { getBaseUrl } from './siteConfig';

export async function syncWhatsAppProduct(adminDb, productId) {
  const productRef = adminDb.collection('products').doc(productId);
  const stateRef = adminDb.collection('whatsapp_catalog_sync').doc(productId);
  const owner = randomUUID();
  await adminDb.runTransaction(async tx => {
    const state = (await tx.get(stateRef)).data() || {};
    if (state.leaseUntil > Date.now()) throw new Error('WhatsApp senkronizasyonu sürüyor; yeniden deneyin.');
    tx.set(stateRef, { owner, leaseUntil: Date.now() + 300000, status: 'pending' }, { merge: true });
  });
  try {
    const [snap, stateSnap] = await Promise.all([productRef.get(), stateRef.get()]);
    const product = snap.exists ? { ...snap.data(), id: productId } : null;
    const previous = stateSnap.data() || {};
    const sku = String(product?.sku || previous.sku || '').trim();
    if (!sku) throw new Error('Senkronizasyon için benzersiz SKU gerekli.');
    const duplicate = await adminDb.collection('products').where('sku', '==', sku).limit(2).get();
    if (duplicate.docs.some(doc => doc.id !== productId)) throw new Error('SKU başka bir ürün tarafından kullanılıyor.');
    const payload = product?.whatsappPublished === true ? buildWhatsAppPayload(product, {
      baseUrl: getBaseUrl(), bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    }) : null;
    const obsoleteSku = previous.obsoleteSku || (previous.sku && previous.sku !== sku ? previous.sku : null);
    await stateRef.set({ sku, obsoleteSku }, { merge: true });
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const meta = new MetaCatalog({ token: process.env.META_CATALOG_ACCESS_TOKEN, catalogId: process.env.META_CATALOG_ID || '1610542617193791', version: process.env.META_GRAPH_API_VERSION || 'v26.0' });
    if (obsoleteSku) {
      await meta.sync(obsoleteSku, null);
      await stateRef.set({ obsoleteSku: null }, { merge: true });
    }
    // Always verify the remote SKU so externally removed items can be recreated.
    const result = await meta.sync(sku, payload);
    const latest = await productRef.get();
    const changed = JSON.stringify(latest.data() || null) !== JSON.stringify(snap.data() || null);
    const status = changed ? 'pending' : payload ? 'synced' : 'removed';
    await adminDb.runTransaction(async tx => {
      const state = (await tx.get(stateRef)).data();
      if (state?.owner !== owner) throw new Error('WhatsApp işlem kilidi değişti; yeniden deneyin.');
      tx.set(stateRef, { sku, hash, metaId: result.id, status, lastError: null, syncedAt: FieldValue.serverTimestamp(), owner: null, leaseUntil: 0 }, { merge: true });
    });
    return { ...result, status, published: latest.data()?.whatsappPublished === true, extraImageCount: payload?.additional_image_urls.length || 0 };
  } catch (error) {
    // Never persist upstream response bodies or credentials.
    const message = error.message?.startsWith('Meta Catalog') || error.message?.startsWith('WhatsApp') || error.message?.startsWith('SKU') || error.message?.startsWith('Senkronizasyon') || error.message?.startsWith('META_') ? error.message : 'WhatsApp senkronizasyonu başarısız; yeniden deneyin.';
    await adminDb.runTransaction(async tx => {
      const state = (await tx.get(stateRef)).data();
      if (state?.owner === owner) tx.set(stateRef, { status: 'error', lastError: message, owner: null, leaseUntil: 0 }, { merge: true });
    });
    throw new Error(message);
  }
}

export async function reconcileWhatsAppCatalog(adminDb, cursor = "") {
  const [published, states] = await Promise.all([
    adminDb.collection('products').where('whatsappPublished', '==', true).get(),
    adminDb.collection('whatsapp_catalog_sync').get(),
  ]);
  const ids = [...new Set([...published.docs.map(doc => doc.id), ...states.docs.filter(doc => doc.data().status !== 'removed').map(doc => doc.id)])];
  const pending = ids.sort().filter(id => id > cursor);
  const results = [];
  const started = Date.now();
  for (const id of pending.slice(0, 5)) {
    try { results.push({ productId: id, ok: true, ...await syncWhatsAppProduct(adminDb, id) }); }
    catch (error) { results.push({ productId: id, ok: false, error: error.message }); }
    if (Date.now() - started > 180000) break;
  }
  return { results, nextCursor: pending.length > results.length ? results.at(-1)?.productId || null : null };
}
