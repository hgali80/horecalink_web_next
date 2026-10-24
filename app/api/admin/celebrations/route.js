import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/app/lib/server/firebaseAdmin';
import { normalizeCelebration, validateCelebrationUpdate } from '@/app/lib/celebrations';
import { invalidateCelebration } from '@/app/lib/server/celebrationCache';

const roles = new Set(['admin', 'super_admin']);
export async function GET(request) {
  try {
    const access = await authorizeAdminRequest(request, roles);
    if (!access.ok) return access.response;
    const snapshot = await access.adminDb.collection('siteContent').doc('celebrations').get();
    return NextResponse.json(normalizeCelebration(snapshot.data()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Admin celebration read failed', error);
    return NextResponse.json({ error: 'Ayarlar okunamadı. Oturumunuzu kontrol edip tekrar deneyin.' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const access = await authorizeAdminRequest(request, roles);
    if (!access.ok) return access.response;
    let update;
    try { update = validateCelebrationUpdate(await request.json()); }
    catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
    const ref = access.adminDb.collection('siteContent').doc('celebrations');
    const result = await access.adminDb.runTransaction(async transaction => {
      const current = normalizeCelebration((await transaction.get(ref)).data());
      if (current.revision !== update.revision) return null;
      const next = { activeId: update.activeId, revision: current.revision + 1 };
      transaction.set(ref, next);
      return next;
    });
    if (!result) return NextResponse.json({ error: 'Başka bir oturum ayarları değiştirdi. Sayfayı yenileyin.' }, { status: 409 });
    invalidateCelebration();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Celebration save failed', error);
    return NextResponse.json({ error: 'Kutlama kaydedilemedi. Sayfayı yenileyip tekrar deneyin.' }, { status: 500 });
  }
}
