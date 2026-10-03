import { getStoredProductImageNames } from '../productImageNames.mjs';

const text = value => String(value ?? '').trim();
export function buildWhatsAppPayload(product, options = {}) {
  const sku = text(product.sku);
  const name = text(product.name_ru || product.name);
  const price = Number(product.price);
  const brand = text(product.brand);
  const labels = { material: 'Материал', dimensions: 'Размеры', capacity: 'Объем', power: 'Мощность', voltage: 'Напряжение', fuelType: 'Тип топлива', warranty: 'Гарантия' };
  const description = [text(product.specs), ...Object.entries(labels).map(([key, label]) => text(product[key]) ? `${label}: ${text(product[key])}` : '')].filter(Boolean).join('\n');
  const bucket = options.bucket || 'horecakatalog-e2d10.firebasestorage.app';
  const images = getStoredProductImageNames(product).map(file => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(`product_images/${file}`)}?alt=media`);
  if (!sku || !name || !brand || !description || !images.length || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(Math.round(price * 100))) {
    throw new Error('WhatsApp için SKU, Rusça ad, marka, teknik özellik, görsel ve pozitif fiyat gerekli.');
  }
  return {
    retailer_id: sku, name, description, brand, condition: 'new',
    currency: 'KZT', price: Math.round(price * 100),
    // Catalog publication is independent of inventory; items can be ordered.
    availability: 'available for order',
    url: `${(options.baseUrl || 'https://horecalink.kz').replace(/\/$/, '')}/products/${encodeURIComponent(text(product.slug) || text(product.id))}`,
    image_url: images[0], additional_image_urls: images.slice(1, 21),
  };
}
