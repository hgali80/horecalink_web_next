import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';
import { listTemplates } from '@/app/lib/server/whatsappTemplates';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    return inboxJson(await listTemplates({ cursor: new URL(request.url).searchParams.get('cursor') || '' }));
  } catch (error) { return inboxJson({ error: error.status ? error.message : 'Şablon listesi alınamadı.' }, error.status || 503); }
}
