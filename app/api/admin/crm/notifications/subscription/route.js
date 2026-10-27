import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';
import { readBoundedBody } from '@/app/lib/server/whatsappInboxCore.mjs';
import { replyError } from '@/app/lib/server/whatsappReplyCore.mjs';
import { hash, SUBSCRIPTIONS, NOTIFICATIONS } from '@/app/lib/server/crmAutomationCore.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    return inboxJson({ enabled: process.env.CRM_BROWSER_PUSH_ENABLED === 'true', vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '' });
  } catch { return inboxJson({ error: 'Bildirim ayarı alınamadı.' }, 503); }
}
async function mutate(request, remove) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    let body; try { body = JSON.parse((await readBoundedBody(request, 4096)).toString('utf8')); } catch { throw replyError('Bildirim kaydı geçersiz.'); }
    let id;
    if (remove) { if (!/^[a-f0-9]{64}$/.test(body?.id || '')) throw replyError('Bildirim kaydı geçersiz.'); id = body.id; }
    else {
      if (process.env.CRM_BROWSER_PUSH_ENABLED !== 'true' || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) throw replyError('Tarayıcı bildirimi henüz yapılandırılmadı.', 503);
      if (typeof body?.token !== 'string' || body.token.length < 40 || body.token.length > 2048 || !/^[a-zA-Z0-9_:\-]+$/.test(body.token)) throw replyError('Bildirim kaydı geçersiz.');
      id = hash(body.token);
    }
    const ref = auth.adminDb.collection(SUBSCRIPTIONS).doc(id), now = Date.now();
    await auth.adminDb.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (remove) { if (current && current.uid !== auth.uid) throw replyError('Bu bildirim kaydı size ait değil.', 403); if (current) tx.delete(ref); return; }
      const owned = await tx.get(auth.adminDb.collection(SUBSCRIPTIONS).where('uid', '==', auth.uid).limit(11));
      const active = owned.docs.filter(doc => doc.id !== id && (doc.data().expiresAt?.toMillis?.() || doc.data().expiresAt?.getTime?.() || 0) > now);
      if (active.length >= 10) throw replyError('En fazla 10 tarayıcı kaydedilebilir. Önce eski bir tarayıcıyı kapatın.', 409);
      for (const doc of owned.docs) if (doc.id !== id && (doc.data().expiresAt?.toMillis?.() || doc.data().expiresAt?.getTime?.() || 0) <= now) tx.delete(doc.ref);
      tx.set(ref, { uid: auth.uid, token: body.token, updatedAt: new Date(now), expiresAt: new Date(now + 14 * 86400000) });
    });
    if (!remove) {
      const unread = await auth.adminDb.collection(NOTIFICATIONS).where('uid', '==', auth.uid).orderBy('__name__', 'desc').limit(30).get();
      const batch = auth.adminDb.batch(); let count = 0;
      for (const doc of unread.docs) if (count < 5 && doc.data().status === 'unread' && doc.data().pushState === 'no_subscription') { batch.update(doc.ref, { pushState: 'pending' }); count++; }
      if (count) await batch.commit();
    }
    return inboxJson({ ok: true, id });
  } catch (error) { return inboxJson({ error: error.status ? error.message : 'Bildirim kaydı güncellenemedi.' }, error.status || 503); }
}
export const POST = request => mutate(request, false);
export const DELETE = request => mutate(request, true);
