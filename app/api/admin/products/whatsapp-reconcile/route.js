import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authorizeAdminRequest, getAdminServices } from '@/app/lib/server/firebaseAdmin';
import { reconcileWhatsAppCatalog } from '@/app/lib/server/whatsappCatalog';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request) {
  try {
    const secret = process.env.META_CATALOG_RECONCILE_SECRET;
    const supplied = request.headers.get('authorization') || '';
    const expected = secret ? `Bearer ${secret}` : '';
    const cron = expected && Buffer.byteLength(expected) === Buffer.byteLength(supplied) && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
    let adminDb;
    if (cron) adminDb = getAdminServices().adminDb;
    else { const auth = await authorizeAdminRequest(request, new Set(['admin', 'super_admin'])); if (!auth.ok) return auth.response; adminDb = auth.adminDb; }
    const body = await request.json().catch(() => ({}));
    const { results, nextCursor } = await reconcileWhatsAppCatalog(adminDb, typeof body.cursor === "string" ? body.cursor : "");
    return NextResponse.json({ ok: results.every(item => item.ok), results, nextCursor });
  } catch { return NextResponse.json({ error: 'WhatsApp katalog kontrolü başarısız.' }, { status: 500 }); }
}
