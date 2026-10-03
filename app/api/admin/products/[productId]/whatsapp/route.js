import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { authorizeAdminRequest } from '@/app/lib/server/firebaseAdmin';
import { syncWhatsAppProduct } from '@/app/lib/server/whatsappCatalog';
export const runtime = 'nodejs';
export async function POST(request, context) {
  try {
    const authorization = await authorizeAdminRequest(request, new Set(['admin', 'super_admin']));
    if (!authorization.ok) return authorization.response;
    const { productId } = await context.params;
    const body = await request.json();
    const ref = authorization.adminDb.collection('products').doc(productId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 });
    if ('published' in body) {
      if (typeof body.published !== 'boolean') return NextResponse.json({ error: 'Yayın tercihi geçersiz.' }, { status: 400 });
      await ref.update({ whatsappPublished: body.published, updatedAt: FieldValue.serverTimestamp() });
    }
    try { return NextResponse.json({ ok: true, ...await syncWhatsAppProduct(authorization.adminDb, productId) }); }
    catch (error) { return NextResponse.json({ error: error.message, published: body.published ?? snap.data().whatsappPublished === true }, { status: 502 }); }
  } catch { return NextResponse.json({ error: 'WhatsApp isteği işlenemedi.' }, { status: 500 }); }
}
