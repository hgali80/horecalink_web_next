import 'server-only';
import { NextResponse } from 'next/server';
import { getAdminServices } from './firebaseAdmin';
import { INBOX_ROLES } from './whatsappInboxCore.mjs';

export function inboxJson(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization' } });
}

export async function authorizeWhatsAppRequest(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || !header.slice(7).trim()) return { ok: false, response: inboxJson({ error: 'Oturum açmanız gerekiyor.' }, 401) };
  const { adminAuth, adminDb } = getAdminServices();
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(header.slice(7).trim(), true); }
  catch { return { ok: false, response: inboxJson({ error: 'Oturum geçersiz. Yeniden giriş yapın.' }, 401) }; }
  const user = (await adminDb.collection('users').doc(decoded.uid).get()).data();
  if (user?.isActive !== true || !INBOX_ROLES.has(user?.role)) return { ok: false, response: inboxJson({ error: 'Bu alana erişim yetkiniz yok.' }, 403) };
  return { ok: true, adminDb, uid: decoded.uid };
}

export const inboxIso = value => value?.toDate?.()?.toISOString() || null;
