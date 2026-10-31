import { NextResponse } from 'next/server';
import { authorizedWorker, processSocialJobs } from '@/app/lib/server/socialWorker';
export const runtime = 'nodejs';
export const maxDuration = 240;
export async function GET(request) {
  if (!authorizedWorker(request)) return NextResponse.json({ error: 'Yetkisiz istek.' }, { status: 401 });
  try { return NextResponse.json(await processSocialJobs(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Yayın işçisi tamamlanamadı.' }, { status: 500 }); }
}
