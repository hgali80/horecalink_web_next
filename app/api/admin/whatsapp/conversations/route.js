import { authorizeWhatsAppRequest, inboxIso, inboxJson } from '@/app/lib/server/whatsappInbox';
import { INBOX_COLLECTION, validInboxId } from '@/app/lib/server/whatsappInboxCore.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request);
    if (!auth.ok) return auth.response;
    const cursor = new URL(request.url).searchParams.get('cursor');
    const collection = auth.adminDb.collection(INBOX_COLLECTION);
    let query = collection.orderBy('updatedAt', 'desc');
    if (cursor) {
      if (!validInboxId(cursor)) return inboxJson({ error: 'Sayfa bilgisi geçersiz.' }, 400);
      const doc = await collection.doc(cursor).get();
      if (!doc.exists) return inboxJson({ error: 'Listeyi yenileyin.' }, 400);
      query = query.startAfter(doc);
    }
    const snapshot = await query.limit(31).get();
    const docs = snapshot.docs.slice(0, 30);
    return inboxJson({ ok: true, conversations: docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, senderId: data.senderId, contactName: data.contactName || '', lastMessageType: data.lastMessageType, lastMessagePreview: data.lastMessagePreview || '', lastIncomingAt: inboxIso(data.lastIncomingAt) };
    }), nextCursor: snapshot.size > 30 ? docs.at(-1).id : null });
  } catch { return inboxJson({ error: 'Konuşmalar alınamadı.' }, 503); }
}
