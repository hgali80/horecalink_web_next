import { NextResponse } from 'next/server';
import { getAdminServices } from '@/app/lib/server/firebaseAdmin';
import { normalizeIncoming, persistIncoming, readBoundedBody, secretMatches, verifyWebhookSignature } from '@/app/lib/server/whatsappInboxCore.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function configured() {
  return process.env.WHATSAPP_INBOX_ENABLED === 'true' &&
    process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN &&
    process.env.WHATSAPP_WABA_ID && process.env.WHATSAPP_PHONE_NUMBER_ID;
}

export async function GET(request) {
  if (!configured()) return reply({ error: 'Webhook kullanıma kapalı.' }, 503);
  const params = new URL(request.url).searchParams;
  const challenge = params.get('hub.challenge');
  if (params.get('hub.mode') !== 'subscribe' || !secretMatches(params.get('hub.verify_token'), process.env.WHATSAPP_VERIFY_TOKEN) || !/^\d{1,100}$/.test(challenge || '')) return reply({ error: 'Doğrulama başarısız.' }, 403);
  return new Response(challenge, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!configured()) return reply({ error: 'Webhook kullanıma kapalı.' }, 503);
  let messages;
  try {
    const body = await readBoundedBody(request);
    if (!verifyWebhookSignature(body, request.headers.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET)) return reply({ error: 'Doğrulama başarısız.' }, 401);
    messages = normalizeIncoming(JSON.parse(body.toString('utf8')), {
      wabaId: process.env.WHATSAPP_WABA_ID, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    });
  } catch (error) {
    return reply({ error: 'Webhook verisi geçersiz.' }, error.message === 'BODY_TOO_LARGE' ? 413 : 400);
  }
  try {
    if (messages.length) await persistIncoming(getAdminServices().adminDb, messages);
    return reply({ ok: true });
  } catch {
    // No raw events, message bodies, tokens or upstream errors in logs.
    return reply({ error: 'Mesajlar kaydedilemedi.' }, 503);
  }
}
