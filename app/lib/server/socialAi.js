import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { aiOptions, aiFacts, aiCacheKey, requestAiCaptions, AI_MODEL } from './socialAiCore.mjs';
import { invalid, validId } from '../socialPublishing.mjs';

export async function generateSocialCaptions(db, body, uid, { env = process.env, generate = requestAiCaptions, now = Date.now() } = {}) {
  if (!validId(body?.productId)) throw invalid('Ürün seçin.');
  const options = aiOptions(body);
  const snap = await db.collection('products').doc(body.productId).get();
  const product = snap.data();
  if (!snap.exists || product.active !== true || product.webPublished !== true) throw invalid('Ürün artık webde yayında değil.', 409);
  const model = env.OPENAI_SOCIAL_MODEL || AI_MODEL;
  const facts = aiFacts(product, body.productId, options), key = aiCacheKey(facts, options, model);
  const cache = db.collection('social_ai_cache').doc(key), owner = randomUUID();
  const day = new Date(now + 5 * 3600000).toISOString().slice(0, 10);
  const globalRef = db.collection('social_ai_usage').doc(`global_${day}`);
  const userRef = db.collection('social_ai_usage').doc(`user_${day}_${createHash('sha256').update(uid).digest('hex')}`);
  const clamp = (value, fallback) => Number.isInteger(Number(value)) && Number(value) >= 1 ? Math.min(Number(value), 100) : fallback;
  const limit = clamp(env.SOCIAL_AI_DAILY_LIMIT, 20), userLimit = Math.min(clamp(env.SOCIAL_AI_USER_DAILY_LIMIT, 10), limit);
  const reservation = await db.runTransaction(async tx => {
    const cached = (await tx.get(cache)).data();
    if (cached?.status === 'ready' && cached.expiresAt > now) return { cached: true, captions: cached.captions };
    if (!env.OPENAI_API_KEY) throw invalid('Sunucuda OpenAI bağlantısı hazır değil. Elle metin yazabilirsiniz.', 503);
    if (cached?.status === 'pending' && cached.leaseUntil > now) throw invalid('Aynı ürün için öneri hazırlanıyor. Biraz sonra tekrar deneyin.', 429);
    const global = (await tx.get(globalRef)).data() || {}, user = (await tx.get(userRef)).data() || {};
    if ((global.count || 0) >= limit || (user.count || 0) >= userLimit) throw invalid('Günlük AI üretim sınırına ulaşıldı. Kayıtlı önerileri kullanabilir veya elle yazabilirsiniz.', 429);
    if (now - (user.lastAttempt || 0) < 15000) throw invalid('Yeni AI üretimi için 15 saniye bekleyin.', 429);
    tx.set(cache, { status: 'pending', owner, leaseUntil: now + 90000, productId: body.productId, createdAt: now });
    tx.set(globalRef, { count: (global.count || 0) + 1, day });
    tx.set(userRef, { count: (user.count || 0) + 1, day, lastAttempt: now });
    return { cached: false, remaining: limit - (global.count || 0) - 1 };
  });
  if (reservation.cached) return { cached: true, captions: reservation.captions };
  try {
    const result = await generate(facts, options, model, env.OPENAI_API_KEY);
    await db.runTransaction(async tx => {
      const current = (await tx.get(cache)).data();
      if (current?.owner !== owner) throw invalid('AI işlem durumu değişti. Sayfayı yenileyin.', 409);
      tx.set(cache, { status: 'ready', productId: body.productId, captions: result.captions, model, usage: result.usage, createdAt: now, expiresAt: now + 30 * 86400000 });
    });
    return { cached: false, captions: result.captions, remaining: reservation.remaining };
  } catch (error) {
    await db.runTransaction(async tx => { const current = (await tx.get(cache)).data(); if (current?.owner === owner) tx.set(cache, { status: 'error', productId: body.productId, updatedAt: now }); });
    throw error.safe ? error : invalid('AI metni hazırlanamadı; otomatik tekrar denenmedi. Elle yazabilirsiniz.', 502);
  }
}
