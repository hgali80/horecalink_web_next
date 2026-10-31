import { NextResponse } from 'next/server';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { authorizeAdminRequest, getAdminServices } from '@/app/lib/server/firebaseAdmin';
import { CHANNELS, validId } from '@/app/lib/socialPublishing.mjs';

export const runtime = 'nodejs';
const roles = new Set(['admin', 'super_admin']);
export async function POST(request) {
  try {
    const auth = await authorizeAdminRequest(request, roles);
    if (!auth.ok) return auth.response;
    if (Number(request.headers.get('content-length')) > 11 * 1024 * 1024) return NextResponse.json({ error: 'En fazla 10 MB yükleyin.' }, { status: 413 });
    const form = await request.formData(), file = form.get('file'), productId = form.get('productId'), channel = form.get('channel');
    if (!validId(productId) || !CHANNELS.includes(channel) || !file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Ürün, kanal ve en fazla 10 MB görsel seçin.' }, { status: 400 });
    if (!(await auth.adminDb.collection('products').doc(productId).get()).exists) return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 });
    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input, { limitInputPixels: 40000000 }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1) return NextResponse.json({ error: 'Tek kare JPEG, PNG veya WebP seçin.' }, { status: 400 });
    const bytes = await sharp(input, { limitInputPixels: 40000000 }).rotate().resize(1080, 1350, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
    const id = randomUUID(), storagePath = `social_media/${productId}/${channel}/${id}.jpg`;
    const { adminStorage } = getAdminServices();
    await adminStorage.bucket().file(storagePath).save(bytes, { resumable: false, contentType: 'image/jpeg', metadata: { cacheControl: 'private, max-age=0' }, preconditionOpts: { ifGenerationMatch: 0 } });
    await auth.adminDb.collection('social_media_assets').doc(id).create({ productId, channel, storagePath, hash: createHash('sha256').update(bytes).digest('hex'), mimeType: 'image/jpeg', size: bytes.length, width: 1080, height: 1350, status: 'ready', createdBy: auth.requester.uid, createdAt: Date.now() });
    return NextResponse.json({ id, width: 1080, height: 1350 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Görsel işlenemedi. JPEG, PNG veya WebP dosyasını kontrol edin.' }, { status: 400 }); }
}
export async function GET(request) {
  try {
    const auth = await authorizeAdminRequest(request, roles);
    if (!auth.ok) return auth.response;
    const id = new URL(request.url).searchParams.get('id');
    if (!validId(id)) return new NextResponse(null, { status: 400 });
    const asset = (await auth.adminDb.collection('social_media_assets').doc(id).get()).data();
    if (!asset || asset.status !== 'ready') return new NextResponse(null, { status: 404 });
    const { adminStorage } = getAdminServices();
    const [bytes] = await adminStorage.bucket().file(asset.storagePath).download();
    return new NextResponse(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new NextResponse(null, { status: 500 }); }
}
