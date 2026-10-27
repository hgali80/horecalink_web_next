import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';
import { readBoundedBody } from '@/app/lib/server/whatsappInboxCore.mjs';
import { cardOptions, cardFacts, cardError } from '@/app/lib/server/whatsappProductCardCore.mjs';
import { renderProductCard } from '@/app/lib/server/whatsappProductCard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function POST(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    let options;
    try { options = cardOptions(JSON.parse((await readBoundedBody(request, 2048)).toString('utf8'))); }
    catch (error) { throw error.status ? error : cardError('Ürün kartı isteği geçersiz.'); }
    // Bound image rendering/fetch work across tabs, without contacting Meta or OpenAI.
    const limit = auth.adminDb.collection('whatsapp_card_limits').doc(auth.uid);
    await auth.adminDb.runTransaction(async tx => {
      const prior = (await tx.get(limit)).data() || {}, now = Date.now(), hour = Math.floor(now / 3600000);
      if (now - (prior.lastAttempt || 0) < 2000 || (prior.hour === hour && prior.count >= 120)) throw cardError('Çok sık kart hazırlanıyor. Biraz bekleyin.', 429);
      tx.set(limit, { lastAttempt: now, hour, count: prior.hour === hour ? prior.count + 1 : 1, expiresAt: new Date(now + 86400000) });
    });
    const product = await auth.adminDb.collection('products').doc(options.productId).get();
    const facts = cardFacts(options.productId, product.data(), options), card = await renderProductCard(facts);
    return inboxJson({ image: `data:image/jpeg;base64,${card.buffer.toString('base64')}`, productRevision: card.productRevision, cardRevision: card.cardRevision, productName: facts.name, productUrl: facts.url });
  } catch (error) { return inboxJson({ error: error.status ? error.message : 'Ürün kartı hazırlanamadı.' }, error.status || 503); }
}
