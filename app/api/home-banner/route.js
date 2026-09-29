import { NextResponse } from 'next/server';
import { getPublicHomeBanner } from '@/app/lib/server/siteContentCache';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  try {
    return NextResponse.json(await getPublicHomeBanner());
  } catch (error) {
    console.error('Home banner read failed', error);
    return NextResponse.json(
      { error: 'Görsel şerit yüklenemedi.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
