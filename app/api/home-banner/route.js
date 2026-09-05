import { NextResponse } from 'next/server';
import { getAdminServices } from '@/app/lib/server/firebaseAdmin';
import { BANNER_DEFAULTS } from '@/app/lib/homeBanner';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection('siteContent').doc('homeBanner').get();
    return NextResponse.json(snapshot.exists ? snapshot.data() : BANNER_DEFAULTS, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Home banner read failed', error);
    return NextResponse.json({ error: 'Görsel şerit yüklenemedi.' }, { status: 500 });
  }
}
