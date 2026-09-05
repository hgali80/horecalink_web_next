import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { authorizeAdminRequest, getAdminServices } from '@/app/lib/server/firebaseAdmin';
import { isCategoryImageKey } from '@/app/lib/categoryImages';
import { validateBannerFile } from '@/app/lib/homeBanner';

export const runtime = 'nodejs';
const roles = new Set(['admin', 'super_admin']);

export async function PUT(request) {
  let uploaded;
  let committed = false;
  try {
    const authorization = await authorizeAdminRequest(request, roles);
    if (!authorization.ok) return authorization.response;
    if (Number(request.headers.get('content-length')) > 11 * 1024 * 1024) return NextResponse.json({ error: 'Dosya çok büyük.' }, { status: 413 });
    const form = await request.formData();
    const key = form.get('key');
    if (typeof key !== 'string' || !isCategoryImageKey(key)) throw new Error('Geçersiz ana kategori.');
    const remove = form.get('remove') === 'true';
    let image = null;
    const bucket = getAdminServices().adminStorage.bucket();
    if (!remove) {
      const file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Görsel seçin.');
      validateBannerFile(file);
      const bytes = Buffer.from(await file.arrayBuffer());
      const metadata = await sharp(bytes, { limitInputPixels: 36000000 }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Hareketsiz JPG, PNG veya WebP yükleyin.');
      const normalized = await sharp(bytes, { limitInputPixels: 36000000 }).rotate().resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      const path = `category_images/${randomUUID()}.webp`;
      const token = randomUUID();
      uploaded = bucket.file(path);
      await uploaded.save(normalized, { metadata: { contentType: 'image/webp', metadata: { firebaseStorageDownloadTokens: token } } });
      image = { path, src: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}` };
    }
    const ref = authorization.adminDb.collection('siteContent').doc('categoryImages');
    const { result, previous } = await authorization.adminDb.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data() || { images: {} };
      const images = { ...current.images };
      const previous = images[key];
      if (remove) delete images[key]; else images[key] = image;
      const result = { images };
      transaction.set(ref, result);
      return { result, previous };
    });
    committed = true;
    if (previous?.path?.startsWith('category_images/')) {
      try { await bucket.file(previous.path).delete({ ignoreNotFound: true }); }
      catch (error) { console.error('Category image cleanup failed', error); }
    }
    return NextResponse.json(result);
  } catch (error) {
    if (uploaded && !committed) await uploaded.delete({ ignoreNotFound: true }).catch(() => {});
    console.error('Category image save failed', error);
    return NextResponse.json({ error: error.message || 'Görsel kaydedilemedi.' }, { status: 400 });
  }
}
