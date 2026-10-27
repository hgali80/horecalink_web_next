import { createHash } from 'node:crypto';
export const RECEIPTS = 'whatsapp_delivery_receipts';
const hash = value => createHash('sha256').update(value).digest('hex');
export const receiptId = (phoneId, messageId) => hash(`${phoneId}:${messageId}`);
const rank = { sent: 1, failed: 2, delivered: 3, read: 4 };
export function normalizeStatuses(payload, { wabaId, phoneNumberId, now = Date.now() }) {
  const statuses = [];
  for (const entry of payload.entry || []) {
    if (entry.id !== wabaId) continue;
    for (const change of entry.changes || []) {
      if (change.field !== 'messages' || change.value?.metadata?.phone_number_id !== phoneNumberId) continue;
      if (change.value.statuses !== undefined && !Array.isArray(change.value.statuses)) throw new Error('INVALID_STATUS_BATCH');
      for (const status of change.value.statuses || []) {
        if (!Object.hasOwn(rank, status.status)) continue;
        if (statuses.length >= 100) throw new Error('TOO_MANY_STATUSES');
        const timestamp = Number(status.timestamp) * 1000;
        if (typeof status.id !== 'string' || !status.id || status.id.length > 512 || (typeof status.recipient_id !== 'string' || !/^\d{5,20}$/.test(status.recipient_id)) || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > now + 300000) throw new Error('INVALID_STATUS');
        const code = status.errors?.[0]?.code;
        statuses.push({ id: receiptId(phoneNumberId, status.id), phoneNumberId, metaMessageId: status.id, receiptRecipientId: status.recipient_id, deliveryStatus: status.status,
          deliveryAt: new Date(timestamp), failureCode: Number.isSafeInteger(code) && code >= 0 ? code : null });
      }
    }
  }
  return statuses;
}
export function mergeReceipt(current, event) {
  if (current?.receiptRecipientId && current.receiptRecipientId !== event.receiptRecipientId) return current;
  if (current?.deliveryStatus && rank[current.deliveryStatus] >= rank[event.deliveryStatus]) return current;
  return { ...current, ...event };
}
export function deliveryPatch(receipt, recipient) {
  if (!receipt?.deliveryStatus || receipt.receiptRecipientId !== recipient) return {};
  return { deliveryStatus: receipt.deliveryStatus, deliveryAt: receipt.deliveryAt, deliveryFailureCode: receipt.failureCode ?? null };
}
export async function persistStatuses(db, events, now = Date.now()) {
  if (!events.length) return;
  const grouped = new Map();
  events.forEach(event => grouped.set(event.id, mergeReceipt(grouped.get(event.id), event)));
  await db.runTransaction(async tx => {
    const rows = [];
    for (const [id, event] of grouped) {
      const ref = db.collection(RECEIPTS).doc(id), current = (await tx.get(ref)).data();
      const merged = mergeReceipt(current, event);
      if (merged === current) continue;
      let messageRef = null, message = null, conversationRef = null, conversation = null;
      if (current?.conversationId && current?.messageId && current.recipientId === event.receiptRecipientId) {
        conversationRef = db.collection('whatsapp_conversations').doc(current.conversationId);
        messageRef = conversationRef.collection('messages').doc(current.messageId);
        message = (await tx.get(messageRef)).data(); conversation = (await tx.get(conversationRef)).data();
      }
      rows.push({ ref, merged, current, messageRef, message, conversationRef, conversation });
    }
    for (const row of rows) {
      tx.set(row.ref, { ...row.merged, expiresAt: row.current?.expiresAt || new Date(now + 90 * 86400000) });
      if (row.message && row.message.metaMessageId === row.merged.metaMessageId && row.message.phoneNumberId === row.merged.phoneNumberId && row.message.senderId === row.merged.receiptRecipientId) {
        tx.update(row.messageRef, { ...deliveryPatch(row.merged, row.message.senderId), ...(['unknown', 'sending'].includes(row.message.sendState) ? { sendState: 'accepted' } : {}) });
        if (row.conversation) tx.update(row.conversationRef, { activityRevision: hash(`${row.merged.id}:${row.merged.deliveryStatus}`), ...(row.conversation.pendingSendId === row.current.messageId ? { pendingSendId: null } : {}) });
      }
    }
  });
}
