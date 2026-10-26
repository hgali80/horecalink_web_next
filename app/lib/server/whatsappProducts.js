import 'server-only';
import { unstable_cache } from 'next/cache';
import { getAdminServices } from './firebaseAdmin';
import { PUBLIC_PRODUCTS_CACHE_TAG } from './cacheTags';
import { getStoredProductImageNames } from '../productImageNames.mjs';

export function inboxProduct(id, data) {
  const image = getStoredProductImageNames(data)[0];
  return { id, sku:String(data.sku || ''), name:String(data.name_ru || data.name || ''), nameTr:String(data.name_tr || ''), nameKk:String(data.name_kk || ''), brand:String(data.brand || ''), specs:String(data.specs || '').slice(0,2500), price:Number(data.price) > 0 ? Number(data.price) : null,
    url:`https://horecalink.kz/products/${encodeURIComponent(data.slug || id)}`,
    image:image ? `https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/${encodeURIComponent(`product_images/${image}`)}?alt=media` : null };
}
export const inboxCatalog = unstable_cache(async () => {
  const { adminDb } = getAdminServices();
  const snapshot = await adminDb.collection('products').where('active','==',true).where('webPublished','==',true).select('sku','slug','name','name_ru','name_tr','name_kk','brand','specs','price','image_names','imageBase').get();
  return snapshot.docs.map(doc => inboxProduct(doc.id,doc.data()));
}, ['whatsapp-product-suggestions-v1'], { revalidate:3600, tags:[PUBLIC_PRODUCTS_CACHE_TAG] });
