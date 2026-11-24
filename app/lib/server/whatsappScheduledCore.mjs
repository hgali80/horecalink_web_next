import { digest, millis, replyError } from './whatsappReplyCore.mjs';

export const SCHEDULED_COLLECTION = 'whatsapp_scheduled_messages';
export const CONVERSATION_SCHEDULES = 'scheduled_messages';
export const ALMATY_TIME_ZONE = 'Asia/Almaty';
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export function validateSchedule(body, now = Date.now()) {
  if (!body || body.action !== 'create' || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096 ||
      !Number.isSafeInteger(body.scheduledAt) || body.scheduledAt < now + 60_000 || body.scheduledAt > now + 90 * DAY ||
      !/^(?:[a-f0-9]{64}|\d{1,16})$/.test(body.baseRevision || '') || !Number.isSafeInteger(body.baseIncomingAt) ||
      typeof body.reviewedRecipient !== 'string' || !/^\d{5,20}$/.test(body.reviewedRecipient) || body.reviewed !== true ||
      !['text','template'].includes(body.kind || 'text')) throw replyError('Alıcıyı, metni ve en az bir dakika sonraki Almatı gönderim saatini kontrol edip onaylayın.');
  if (body.kind === 'template' && (!/^\d{1,40}$/.test(body.templateId || '') || !/^[a-z0-9_]{1,512}$/.test(body.templateName || '') || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(body.templateLanguage || '') || !/^[a-f0-9]{64}$/.test(body.templateRevision || '') || !Array.isArray(body.parameters) || body.parameters.length > 8 || body.parameters.some(value => typeof value !== 'string' || value.length > 200))) throw replyError('Onaylı şablon ve alanlarını tekrar inceleyin.');
  return { ...body, text: body.text.trim(), kind: body.kind || 'text' };
}

export function windowOpen(lastIncomingAt, at = Date.now()) {
  const last = millis(lastIncomingAt);
  return !!last && at >= last && at - last < DAY;
}

export function scheduleActivityCancellation(plan, { direction, timestamp }) {
  if (plan?.status !== 'scheduled' || !Number.isFinite(timestamp) || timestamp <= millis(plan.createdAt)) return null;
  if (direction === 'incoming') return { status: 'cancelled', cancelReason: 'Müşteri mesaj gönderdi', cancelledAt: new Date(timestamp) };
  if (direction === 'outgoing') return { status: 'cancelled', cancelReason: 'Siz mesaj gönderdiniz', cancelledAt: new Date(timestamp) };
  return null;
}

export function preflightSchedule(plan, conversation, now = Date.now()) {
  if (!plan || plan.status !== 'scheduled') return { ok: false, reason: 'plan_changed' };
  const scheduledAt = millis(plan.scheduledAt), lastIncomingAt = millis(conversation?.lastIncomingAt);
  if (!conversation || conversation.phoneNumberId !== plan.phoneNumberId || conversation.senderId !== plan.senderId) return { ok: false, reason: 'conversation_changed' };
  if (conversation.pendingSendId) return { ok: false, reason: 'manual_send_in_progress' };
  if (lastIncomingAt > millis(plan.createdAt)) return { ok: false, reason: 'customer_message' };
  if (millis(conversation.lastOutgoingAt) > millis(plan.createdAt)) return { ok: false, reason: 'operator_message' };
  if (scheduledAt > now) return { ok: false, reason: 'not_due' };
  if (plan.kind === 'text' && !windowOpen(conversation.lastIncomingAt, now)) return { ok: false, reason: 'window_closed' };
  if (plan.kind === 'template' && (plan.permissionStatus !== 'granted' || plan.permissionRevision !== plan.currentPermissionRevision)) return { ok: false, reason: 'permission_invalid' };
  return { ok: true, claimId: digest(`scheduled:${plan.id}:${plan.scheduledAt}`) };
}

export async function cancelScheduledPlans(tx, db, conversationId, at = Date.now(), reason = 'Siz mesaj gönderdiniz') {
  const collection = db.collection(SCHEDULED_COLLECTION);
  if (typeof collection.where !== 'function') return [];
  const snapshot = await tx.get(collection.where('conversationId', '==', conversationId).where('status', 'in', ['scheduled', 'sending']));
  const due = snapshot.docs.filter(doc => ['scheduled', 'sending'].includes(doc.data().status) && at > millis(doc.data().createdAt));
  for (const doc of due) tx.update(doc.ref, { status: 'cancelled', cancelReason: reason, cancelledAt: new Date(at), updatedAt: new Date(at) });
  return due.map(doc => doc.id);
}

export function almatyDateTimeLabel(value) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: ALMATY_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
