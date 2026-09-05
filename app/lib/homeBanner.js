export const BANNER_DEFAULTS = { slides: [], autoplay: true, interval: 5, revision: 0 };
export const BANNER_MAX_MB = 10;
export const BANNER_MAX_BYTES = BANNER_MAX_MB * 1024 * 1024;
export const BANNER_MIN_RATIO = 2.7;
export const BANNER_MAX_RATIO = 3.3;
export const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateBannerFile(file) {
  if (!BANNER_TYPES.includes(file.type)) throw new Error('Dosya formatı JPG, PNG veya WebP olmalıdır.');
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('Görsel dosyası boş veya okunamıyor.');
  if (file.size > BANNER_MAX_BYTES)
    throw new Error(`Dosya boyutu ${(file.size / 1024 / 1024).toFixed(2)} MB. En fazla ${BANNER_MAX_MB} MB yükleyebilirsiniz.`);
}

export function validateBannerDimensions(width, height) {
  const ratio = width / height;
  if (!Number.isFinite(ratio) || width <= 0 || height <= 0 || ratio < BANNER_MIN_RATIO || ratio > BANNER_MAX_RATIO)
    throw new Error(`Görsel ${width} × ${height} piksel. Yatay oran 3:1'e yakın olmalıdır (2,7:1–3,3:1). Önerilen: 1500 × 500 piksel.`);
  if (width * height > 36000000) throw new Error('Görsel en fazla 36 megapiksel olmalıdır.');
}

export function validateBannerSettings(value) {
  if (!Array.isArray(value.slides) || value.slides.length < 2 || value.slides.length > 5)
    throw new Error('En az 2, en fazla 5 görsel ekleyin.');
  if (typeof value.autoplay !== 'boolean' || !Number.isInteger(value.interval) || value.interval < 2 || value.interval > 60)
    throw new Error('Geçiş süresi 2–60 saniye arasında olmalıdır.');
  if (!Number.isInteger(value.revision) || value.revision < 0) throw new Error('Sayfayı yenileyin.');
  const ids = new Set();
  for (const slide of value.slides) {
    if (!slide || typeof slide.id !== 'string' || !/^[\w-]{1,80}$/.test(slide.id) || ids.has(slide.id))
      throw new Error('Görsel listesi geçersiz.');
    ids.add(slide.id);
    if (typeof slide.alt !== 'string' || !slide.alt.trim() || slide.alt.length > 200)
      throw new Error('Her görsele en fazla 200 karakterlik bir açıklama yazın.');
    if (typeof slide.href !== 'string' || slide.href.length > 2000 || /[\s\\]/.test(slide.href))
      throw new Error('Görsel bağlantısı geçersiz.');
    if (slide.href && !(slide.href.startsWith('/') && !slide.href.startsWith('//'))) {
      let url;
      try { url = new URL(slide.href); } catch { throw new Error('Geçerli bir bağlantı yazın.'); }
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Yalnızca HTTP/HTTPS bağlantıları kullanılabilir.');
    }
  }
}
