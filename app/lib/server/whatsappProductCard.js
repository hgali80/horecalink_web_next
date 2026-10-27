import 'server-only';
import sharp from 'sharp';
import { cardError, cardSvg, factsRevision, imageRevision } from './whatsappProductCardCore.mjs';

export async function renderProductCard(facts) {
  // Only the fixed Firebase bucket URL constructed by cardFacts is accepted; never fetch a client URL.
  const url = new URL(facts.imageUrl);
  if (url.origin !== 'https://firebasestorage.googleapis.com' || !url.pathname.startsWith('/v0/b/horecakatalog-e2d10.firebasestorage.app/o/product_images%2F')) throw cardError('Ürün fotoğrafı adresi geçersiz.');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok || !/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type') || '')) throw cardError('Ürün fotoğrafı alınamadı.', 502);
  if (Number(response.headers.get('content-length')) > 5 * 1024 * 1024) throw cardError('Ürün fotoğrafı çok büyük.', 413);
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 5 * 1024 * 1024) { await reader.cancel(); throw cardError('Ürün fotoğrafı çok büyük.', 413); } chunks.push(Buffer.from(value)); }
  } finally { reader.releaseLock(); }
  const photo = await sharp(Buffer.concat(chunks), { limitInputPixels: 40000000 }).rotate().resize(968, 506, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
  const buffer = await sharp(Buffer.from(cardSvg(facts, `data:image/jpeg;base64,${photo.toString('base64')}`))).jpeg({ quality: 88 }).toBuffer();
  return { buffer, productRevision: factsRevision(facts), cardRevision: imageRevision(facts, buffer) };
}
