import { validateBannerFile, validateBannerDimensions, BANNER_MIN_RATIO, BANNER_MAX_RATIO } from './homeBanner.js';

// Five images plus metadata stay below the hosting provider's request limit.
export const BANNER_TRANSFER_MAX_BYTES = 600 * 1024;

export async function readBannerResponse(response) {
  const text = await response.text();
  if (response.status === 413)
    throw new Error('Sunucu yükleme boyutunu reddetti. Sayfayı yenileyip görselleri tekrar seçin; görseller gönderilmeden önce otomatik küçültülür.');
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Sunucudan geçerli yanıt alınamadı (HTTP ${response.status}). Değişiklikler kaydedilmedi; tekrar deneyin.`); }
  if (!response.ok) throw new Error(data?.error || `İşlem tamamlanamadı (HTTP ${response.status}).`);
  if (!data || !Array.isArray(data.slides)) throw new Error('Sunucu yanıtında görsel listesi eksik. Sayfayı yenileyip tekrar deneyin.');
  return data;
}

export async function prepareBannerUpload(file) {
  validateBannerFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    validateBannerDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tarayıcı görseli hazırlayamadı. Güncel bir tarayıcıyla tekrar deneyin.');
    for (const maxWidth of [2400, 1800, 1500, 1200]) {
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.min(Math.floor(canvas.width / BANNER_MIN_RATIO),
        Math.max(Math.ceil(canvas.width / BANNER_MAX_RATIO), Math.round(image.naturalHeight * scale)));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.8, 0.7]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob || blob.type !== 'image/webp') throw new Error('Tarayıcı WebP hazırlamayı desteklemiyor. Güncel bir tarayıcı kullanın.');
        if (blob.size <= BANNER_TRANSFER_MAX_BYTES) {
          return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: blob.type });
        }
      }
    }
    throw new Error(`${file.name}: Görsel gönderime hazırlanamadı. Daha düşük çözünürlüklü bir kopya seçin.`);
  } finally { URL.revokeObjectURL(url); }
}
