import { getStoredProductImageNames } from '../productImageNames.mjs';
import { invalid } from '../socialPublishing.mjs';

// Match ProductGallery's bounded legacy fallback, without listing the bucket.
export async function resolveSocialImages(product, bucket) {
  let names = getStoredProductImageNames(product);
  const stored = names.length > 0;
  if (!stored) {
    const stem = [product.stock_code, product.imageBase, product.sku, product.manufacturerCode, product.id]
      .map(value => String(value ?? '').trim().replace(/\.[a-z0-9]+$/i, ''))
      .find(value => value && value.toLowerCase() !== 'null');
    if (stem && !/[/\\\u0000-\u001f]/.test(stem)) names = Array.from({ length: 12 }, (_, i) => `${stem}${i ? `-${i}` : ''}.jpg`);
  }
  if (names.some(name => /[/\\\u0000-\u001f]/.test(name))) throw invalid('Ürün görsel dosya adı geçersiz.');
  const found = await Promise.all(names.map(async name => {
    try {
      const [metadata] = await bucket.file(`product_images/${name}`).getMetadata();
      return { name, generation: String(metadata.generation) };
    } catch (error) {
      if (!stored && Number(error.code) === 404) return null;
      throw invalid(Number(error.code) === 404 ? 'Kayıtlı ürün görseli depoda bulunamadı.' : 'Ürün görselleri doğrulanamadı. Tekrar deneyin.', 409);
    }
  }));
  const images = found.filter(Boolean);
  return { imageNames: images.map(item => item.name), generations: images.map(item => item.generation) };
}
