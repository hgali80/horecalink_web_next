import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/app/lib/server/firebaseAdmin';
import { generateSocialCaptions } from '@/app/lib/server/socialAi';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request) {
  try {
    const auth = await authorizeAdminRequest(request, new Set(['admin', 'super_admin']));
    if (!auth.ok) return auth.response;
    const raw = await request.text();
    if (raw.length > 2048) return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'İstek geçersiz.' }, { status: 400 }); }
    const result = await generateSocialCaptions(auth.adminDb, body, auth.requester.uid);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error.safe ? error.message : 'AI isteği tamamlanamadı.' }, { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } }); }
}
