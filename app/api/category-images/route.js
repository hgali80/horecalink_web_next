import { NextResponse } from 'next/server';
import { getAdminServices } from '@/app/lib/server/firebaseAdmin';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection('siteContent').doc('categoryImages').get();
    return NextResponse.json(snapshot.data() || { images: {} }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Category images read failed', error);
    return NextResponse.json({ error: 'Kategori görselleri yüklenemedi.' }, { status: 500 });
  }
}
