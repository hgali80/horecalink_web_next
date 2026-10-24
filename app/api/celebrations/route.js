import { NextResponse } from 'next/server';
import { getPublicCelebration } from '@/app/lib/server/celebrationCache';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json(await getPublicCelebration(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Celebration read failed', error);
    return NextResponse.json({ error: 'Kutlama ayarları yüklenemedi.' }, { status: 503 });
  }
}
