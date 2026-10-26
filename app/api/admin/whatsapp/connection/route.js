import { authorizeWhatsAppRequest, inboxIso, inboxJson } from '@/app/lib/server/whatsappInbox';
import { inspectWhatsAppConnection } from '@/app/lib/server/whatsappConnectionCore.mjs';
import { INBOX_COLLECTION } from '@/app/lib/server/whatsappInboxCore.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request);
    if (!auth.ok) return auth.response;
    const connection = await inspectWhatsAppConnection(process.env, fetch, new URL(request.url).searchParams.get('meta') === '1');
    const latest = await auth.adminDb.collection(INBOX_COLLECTION).orderBy('updatedAt', 'desc').limit(1).get();
    return inboxJson({ ...connection, lastIncomingAt: inboxIso(latest.docs[0]?.data().lastIncomingAt) });
  } catch { return inboxJson({ error: 'Bağlantı durumu kontrol edilemedi.' }, 503); }
}
