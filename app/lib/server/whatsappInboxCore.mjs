import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const MAX_WEBHOOK_BYTES = 512 * 1024;
export const INBOX_COLLECTION = 'whatsapp_conversations';
export const INBOX_ROLES = new Set(['admin', 'super_admin']);
export const validInboxId = value => /^[a-f0-9]{64}$/.test(value || '');
const hash = value => createHash('sha256').update(value).digest('hex');

export function secretMatches(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyWebhookSignature(body, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || '')) return false;
  return secretMatches(signature, `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
}

export async function readBoundedBody(request, limit = MAX_WEBHOOK_BYTES) {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('BODY_TOO_LARGE');
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('BODY_TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}

// Store only normalized incoming content, never the raw event or media URLs.
export function normalizeIncoming(payload, { wabaId, phoneNumberId, now = Date.now() }) {
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) throw new Error('INVALID_EVENT');
  const messages = new Map();
  let count = 0;
  for (const entry of payload.entry) {
    if (entry.id !== wabaId) continue;
    for (const change of entry.changes || []) {
      const value = change.value;
      if (change.field !== 'messages' || value?.metadata?.phone_number_id !== phoneNumberId) continue;
      if (value.messages !== undefined && !Array.isArray(value.messages)) throw new Error('INVALID_EVENT');
      for (const message of value.messages || []) {
        if (++count > 100) throw new Error('TOO_MANY_MESSAGES');
        const timestamp = Number(message.timestamp) * 1000;
        if (typeof message.id !== 'string' || !message.id || message.id.length > 512 ||
            typeof message.from !== 'string' || !/^\d{5,20}$/.test(message.from) ||
            !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > now + 300000 ||
            typeof message.type !== 'string' || !/^[a-z_]{1,40}$/.test(message.type)) throw new Error('INVALID_MESSAGE');
        if (message.type === 'text' && (typeof message.text?.body !== 'string' || message.text.body.length > 8192)) throw new Error('INVALID_MESSAGE');
        const contact = (value.contacts || []).find(item => item.wa_id === message.from);
        const contactName = typeof contact?.profile?.name === 'string' ? contact.profile.name.slice(0, 256) : '';
        const id = hash(`${phoneNumberId}:${message.id}`);
        messages.set(id, {
          id, conversationId: hash(`${phoneNumberId}:${message.from}`),
          metaMessageId: message.id, senderId: message.from, phoneNumberId,
          contactName, type: message.type,
          text: message.type === 'text' ? message.text.body : '', timestamp,
        });
      }
    }
  }
  return [...messages.values()];
}

export async function persistIncoming(db, messages, now = Date.now()) {
  if (!messages.length) return;
  const expiresAt = new Date(now + 90 * 86400000);
  await db.runTransaction(async tx => {
    const refs = messages.map(message => db.collection(INBOX_COLLECTION).doc(message.conversationId).collection('messages').doc(message.id));
    const conversations = new Map(messages.map(message => [message.conversationId, db.collection(INBOX_COLLECTION).doc(message.conversationId)]));
    // All reads precede writes; transaction retries make duplicate deliveries safe.
    const existing = await Promise.all(refs.map(ref => tx.get(ref)));
    const current = new Map(await Promise.all([...conversations].map(async ([id, ref]) => [id, (await tx.get(ref)).data() || {}])));
    const updates = new Map();
    const revisions = new Map();
    messages.forEach((message, index) => {
      if (existing[index].exists) return;
      const previousRevision = revisions.get(message.conversationId) || current.get(message.conversationId).lastIncomingRevision || '';
      revisions.set(message.conversationId, hash(`${previousRevision}:${message.id}`));
      tx.create(refs[index], { ...message, receivedAt: new Date(now), expiresAt });
      const prior = updates.get(message.conversationId) || current.get(message.conversationId);
      if (message.timestamp >= (prior.lastIncomingAt?.getTime?.() || prior.lastIncomingAt?.toMillis?.() || 0)) {
        updates.set(message.conversationId, {
          senderId: message.senderId, phoneNumberId: message.phoneNumberId,
          contactName: message.contactName || prior.contactName || '',
          lastIncomingAt: new Date(message.timestamp), updatedAt: new Date(message.timestamp),
          lastMessageType: message.type, lastMessagePreview: message.text.slice(0, 240), expiresAt,
        });
      }
    });
    for (const [id, revision] of revisions) tx.set(conversations.get(id), { ...(updates.get(id) || {}), lastIncomingRevision: revision }, { merge: true });
  });
}
