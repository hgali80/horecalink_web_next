import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/app/lib/server/firebaseAdmin';
import { createPost, transitionPost, saveSettings, settings, connectionConfig } from '@/app/lib/server/socialPublishing';
import { getStoredProductImageNames } from '@/app/lib/productImageNames.mjs';

export const runtime = 'nodejs';
const roles = new Set(['admin', 'super_admin']);
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request) {
  try {
    const auth = await authorizeAdminRequest(request, roles);
    if (!auth.ok) return auth.response;
    const db = auth.adminDb, url = new URL(request.url);
    if (url.searchParams.has('products')) {
      const cursor = url.searchParams.get('cursor');
      let query = db.collection('products').orderBy('__name__').limit(50);
      if (cursor) query = query.startAfter(cursor);
      const result = await query.get();
      return reply({ products: result.docs.map(doc => { const p = doc.data(); return { id: doc.id, name: String(p.name_ru || p.name || ''), sku: String(p.sku || ''), webPublished: p.webPublished === true, whatsappPublished: p.whatsappPublished === true, active: p.active === true, imageNames: getStoredProductImageNames(p) }; }), nextCursor: result.size === 50 ? result.docs.at(-1).id : null });
    }
    const [posts, logs, jobs, config] = await Promise.all([
      db.collection('social_posts').orderBy('createdAt', 'desc').limit(50).get(),
      db.collection('social_publish_logs').orderBy('at', 'desc').limit(100).get(),
      db.collection('social_publish_jobs').orderBy('createdAt', 'desc').limit(200).get(), settings(db),
    ]);
    const rows = snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return reply({ posts: rows(posts), logs: rows(logs), jobs: rows(jobs), settings: config, connection: connectionConfig() });
  } catch { return reply({ error: 'Yayın merkezi yüklenemedi. Oturumu ve sunucu bağlantısını kontrol edin.' }, 500); }
}
export async function POST(request) {
  try {
    const auth = await authorizeAdminRequest(request, roles);
    if (!auth.ok) return auth.response;
    if (Number(request.headers.get('content-length')) > 40000) return reply({ error: 'İstek çok büyük.' }, 413);
    const body = await request.json();
    if (body.action === 'settings') await saveSettings(auth.adminDb, body, auth.requester.uid);
    else if (body.action === 'create') return reply({ ok: true, id: await createPost(auth.adminDb, body, auth.requester.uid) });
    else await transitionPost(auth.adminDb, body.id, body, auth.requester.uid);
    return reply({ ok: true });
  } catch (error) { return reply({ error: error.safe ? error.message : 'Yayın işlemi tamamlanamadı.' }, error.status || 500); }
}
