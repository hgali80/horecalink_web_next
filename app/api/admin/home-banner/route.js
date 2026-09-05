import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { authorizeAdminRequest, getAdminServices } from '@/app/lib/server/firebaseAdmin';
import { BANNER_MAX_BYTES, BANNER_TYPES, validateBannerSettings } from '@/app/lib/homeBanner';

export const runtime = 'nodejs';
const roles = new Set(['admin', 'super_admin']);

export async function PUT(request) {
  const uploaded = [];
  let committed = false;
  try {
    const authorization = await authorizeAdminRequest(request, roles);
    if (!authorization.ok) return authorization.response;
    if (Number(request.headers.get('content-length')) > 11 * 1024 * 1024)
      return NextResponse.json({ error: 'Toplam yükleme boyutu çok büyük.' }, { status: 413 });
    const form = await request.formData();
    const settings = JSON.parse(form.get('settings'));
    validateBannerSettings(settings);
    const ref = authorization.adminDb.collection('siteContent').doc('homeBanner');
    const previous = (await ref.get()).data() || { slides: [], revision: 0 };
    if (previous.revision !== settings.revision) return NextResponse.json({ error: 'Ayarlar başka bir oturumda değişti. Sayfayı yenileyin.' }, { status: 409 });
    const pending = [];
    for (const slide of settings.slides) {
      const file = form.get(slide.id);
      if (!file) {
        const existing = previous.slides.find(item => item.id === slide.id);
        if (!existing) throw new Error('Görsel dosyası eksik.');
        pending.push({ ...existing, alt: slide.alt.trim(), href: slide.href });
        continue;
      }
      if (!BANNER_TYPES.includes(file.type) || !file.size || file.size > BANNER_MAX_BYTES)
        throw new Error('Görseller JPG, PNG veya WebP ve en fazla 2 MB olmalıdır.');
      const bytes = Buffer.from(await file.arrayBuffer());
      const metadata = await sharp(bytes, { limitInputPixels: 36000000 }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1)
        throw new Error('Yalnızca hareketsiz JPG, PNG veya WebP yükleyin.');
      const rotated = [5, 6, 7, 8].includes(metadata.orientation);
      const width = rotated ? metadata.height : metadata.width;
      const height = rotated ? metadata.width : metadata.height;
      if (width !== height * 3) throw new Error('Görsel oranı 3:1 olmalıdır (örnek: 1500 × 500 piksel).');
      const normalized = await sharp(bytes).rotate().webp({ quality: 90 }).toBuffer();
      pending.push({ id: slide.id, alt: slide.alt.trim(), href: slide.href, bytes: normalized });
    }
    const bucket = getAdminServices().adminStorage.bucket();
    const slides = [];
    for (const item of pending) {
      if (!item.bytes) { slides.push(item); continue; }
      const path = `home_banners/${randomUUID()}.webp`;
      const token = randomUUID();
      const object = bucket.file(path);
      uploaded.push(object);
      await object.save(item.bytes, { metadata: { contentType: 'image/webp', metadata: { firebaseStorageDownloadTokens: token } } });
      slides.push({ id: item.id, alt: item.alt, href: item.href, path,
        src: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}` });
    }
    const result = { slides, autoplay: settings.autoplay, interval: settings.interval, revision: settings.revision + 1 };
    await authorization.adminDb.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data();
      if ((current?.revision || 0) !== settings.revision) throw new Error('Ayarlar değişti. Sayfayı yenileyip tekrar deneyin.');
      transaction.set(ref, result);
    });
    committed = true;
    const retained = new Set(slides.map(slide => slide.path));
    const removed = previous.slides.filter(slide => slide.path?.startsWith('home_banners/') && !retained.has(slide.path));
    const cleanup = await Promise.allSettled(removed.map(slide => bucket.file(slide.path).delete({ ignoreNotFound: true })));
    cleanup.forEach(result => { if (result.status === 'rejected') console.error('Banner file cleanup failed', result.reason); });
    return NextResponse.json(result);
  } catch (error) {
    if (!committed) await Promise.allSettled(uploaded.map(file => file.delete({ ignoreNotFound: true })));
    console.error('Home banner save failed', error);
    return NextResponse.json({ error: error.message || 'Görsel şerit kaydedilemedi.' }, { status: 400 });
  }
}
