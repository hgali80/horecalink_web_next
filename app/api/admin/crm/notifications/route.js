import { authorizeWhatsAppRequest, inboxJson, inboxIso } from '@/app/lib/server/whatsappInbox';
import { readBoundedBody } from '@/app/lib/server/whatsappInboxCore.mjs';
import { identifier, invalid } from '@/app/lib/crmFollowups.mjs';
import { NOTIFICATIONS, STATE } from '@/app/lib/server/crmAutomationCore.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    const cursor = new URL(request.url).searchParams.get('cursor');
    let query = auth.adminDb.collection(NOTIFICATIONS).where('uid', '==', auth.uid).orderBy('__name__', 'desc');
    if (cursor) query = query.startAfter(identifier(cursor));
    const snapshot = await query.limit(31).get();
    const state = (await auth.adminDb.collection(STATE).doc('followups').get()).data();
    return inboxJson({ notifications: snapshot.docs.slice(0, 30).map(doc => { const data = doc.data(); return { id: doc.id, taskId: data.taskId, kind: data.kind, status: data.status, reason: data.reason, pushState: data.pushState, dueAt: inboxIso(data.dueAt), createdAt: inboxIso(data.createdAt) }; }),
      nextCursor: snapshot.size > 30 ? snapshot.docs[29].id : null, automation: { enabled: process.env.CRM_AUTOMATION_ENABLED === 'true', lastCompletedAt: inboxIso(state?.lastCompletedAt), lastFailedAt: inboxIso(state?.lastFailedAt), more: state?.lastSweepMore ?? !!state?.cursor, errors: state?.lastSweepErrors ?? state?.counts?.errors ?? 0 } });
  } catch (error) { return inboxJson({ error: error.status ? error.message : 'Bildirimler alınamadı.' }, error.status || 503); }
}
export async function PATCH(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    let body; try { body = JSON.parse((await readBoundedBody(request, 1024)).toString('utf8')); } catch { throw invalid('İstek geçersiz.'); }
    const id = identifier(body?.id), ref = auth.adminDb.collection(NOTIFICATIONS).doc(id);
    await auth.adminDb.runTransaction(async tx => { const record = (await tx.get(ref)).data(); if (!record || record.uid !== auth.uid) throw invalid('Bildirim bulunamadı.', 404); tx.update(ref, { status: 'read', readAt: new Date() }); });
    return inboxJson({ ok: true });
  } catch (error) { return inboxJson({ error: error.status ? error.message : 'Bildirim güncellenemedi.' }, error.status || 503); }
}
