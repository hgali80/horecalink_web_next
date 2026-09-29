import { NextResponse } from 'next/server';
import { getPublicCategoryImages } from '@/app/lib/server/siteContentCache';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  try {
    return NextResponse.json(await getPublicCategoryImages());
  } catch (error) {
    console.error('Category images read failed', error);
    return NextResponse.json(
      { error: 'Kategori görselleri yüklenemedi.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
