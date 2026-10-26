import { authorizeWhatsAppRequest, inboxIso, inboxJson } from '@/app/lib/server/whatsappInbox';
import { inspectWhatsAppConnection, subscribeWhatsAppConnection } from '@/app/lib/server/whatsappConnectionCore.mjs';
import { INBOX_COLLECTION, readBoundedBody } from '@/app/lib/server/whatsappInboxCore.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request);
    if (!auth.ok) return auth.response;
    const connection = await inspectWhatsAppConnection(process.env, fetch, new URL(request.url).searchParams.get('meta') === '1');
    const latest = await auth.adminDb.collection(INBOX_COLLECTION).orderBy('updatedAt', 'desc').limit(1).get();
    return inboxJson({ ...connection, lastIncomingAt: inboxIso(latest.docs[0]?.data().lastIncomingAt) });
  } catch { return inboxJson({ error: 'Bağlantı durumu kontrol edilemedi.' }, 503); }
}

export async function POST(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request);
    if (!auth.ok) return auth.response;
    let body;
    try { body = JSON.parse((await readBoundedBody(request, 1024)).toString('utf8')); }
    catch { return inboxJson({ error: 'Bağlantı isteği geçersiz.' }, 400); }
    if (body?.action !== 'subscribe') return inboxJson({ error: 'Bağlantı işlemi seçilmedi.' }, 400);
    const connection = await subscribeWhatsAppConnection(process.env);
    const latest = await auth.adminDb.collection(INBOX_COLLECTION).orderBy('updatedAt', 'desc').limit(1).get();
    return inboxJson({ ...connection, lastIncomingAt: inboxIso(latest.docs[0]?.data().lastIncomingAt) });
  } catch { return inboxJson({ error: 'Hesap aboneliği doğrulanamadı. Yeniden denemeden önce Meta bağlantısını kontrol edin.' }, 503); }
}
