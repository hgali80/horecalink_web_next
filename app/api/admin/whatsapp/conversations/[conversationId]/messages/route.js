import { authorizeWhatsAppRequest, inboxIso, inboxJson } from '@/app/lib/server/whatsappInbox';
import { INBOX_COLLECTION, validInboxId } from '@/app/lib/server/whatsappInboxCore.mjs';

import { incomingRevision, millis, resolveReplyRecipient, safeSendDiagnostics } from '@/app/lib/server/whatsappReplyCore.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request, context) {
  try {
    const auth = await authorizeWhatsAppRequest(request);
    if (!auth.ok) return auth.response;
    const { conversationId } = await context.params;
    if (!validInboxId(conversationId)) return inboxJson({ error: 'Konuşma geçersiz.' }, 400);
    const conversation = auth.adminDb.collection(INBOX_COLLECTION).doc(conversationId);
    const conversationSnapshot = await conversation.get();
    if (!conversationSnapshot.exists) return inboxJson({ error: 'Konuşma bulunamadı.' }, 404);
    const data = conversationSnapshot.data();
    const revision = `${data.activityRevision || data.lastIncomingRevision || ''}:${data.pendingSendId || ''}`;
    if (new URL(request.url).searchParams.get('revisionOnly') === '1') return inboxJson({ revision });
    const collection = conversation.collection('messages');
    let query = collection.orderBy('timestamp', 'desc');
    const cursor = new URL(request.url).searchParams.get('cursor');
    if (cursor) {
      if (!validInboxId(cursor)) return inboxJson({ error: 'Sayfa bilgisi geçersiz.' }, 400);
      const doc = await collection.doc(cursor).get();
      if (!doc.exists) return inboxJson({ error: 'Konuşmayı yenileyin.' }, 400);
      query = query.startAfter(doc);
    }
    const snapshot = await query.limit(21).get();
    const docs = snapshot.docs.slice(0, 20);
    return inboxJson({ ok: true, revision, replyRecipient: resolveReplyRecipient(conversationSnapshot.data(), process.env.WHATSAPP_TEST_RECIPIENT_MAP), baseIncomingAt: millis(conversationSnapshot.data().lastIncomingAt), baseRevision: incomingRevision(conversationSnapshot.data()), messages: docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, direction: data.direction || 'incoming', source: data.source || 'panel', translationTr: data.translationTr || null, sendState: data.sendState || null, sendDiagnostics: data.sendState === 'rejected' ? safeSendDiagnostics(data.sendDiagnostics?.httpStatus, { code: data.sendDiagnostics?.code, error_subcode: data.sendDiagnostics?.subcode }) : null, deliveryStatus: ['sent','delivered','read','failed'].includes(data.deliveryStatus) ? data.deliveryStatus : null, deliveryAt: inboxIso(data.deliveryAt), type: data.type, text: data.text || '', productCardName: data.direction === 'outgoing' ? data.productCard?.name || '' : '', timestamp: new Date(data.timestamp).toISOString(), receivedAt: inboxIso(data.receivedAt) };
    }), nextCursor: snapshot.size > 20 ? docs.at(-1).id : null });
  } catch { return inboxJson({ error: 'Mesajlar alınamadı.' }, 503); }
}
