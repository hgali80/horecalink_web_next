import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';
import { inboxCatalog, inboxProduct } from '@/app/lib/server/whatsappProducts';
import { suggestProducts } from '@/app/lib/whatsappProductSearch.mjs';
export const runtime = 'nodejs';
export async function GET(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request);
    if (!auth.ok) return auth.response;
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      if (id.length>128 || /[\\/]/.test(id)) return inboxJson({error:'Ürün geçersiz.'},400);
      const doc=await auth.adminDb.collection('products').doc(id).get();
      const data=doc.data();
      if (!doc.exists || data.active!==true || data.webPublished!==true) return inboxJson({error:'Ürün artık yayında değil.'},404);
      return inboxJson({product:inboxProduct(doc.id,data)});
    }
    const query = new URL(request.url).searchParams.get('q')?.trim() || '';
    if (query.length < 3) return inboxJson({ products:[] });
    if (query.length > 1000) return inboxJson({ error:'Arama metni çok uzun.' },400);
    return inboxJson({ products:suggestProducts(await inboxCatalog(),query) });
  } catch { return inboxJson({ error:'Ürün önerileri alınamadı.' },503); }
}
