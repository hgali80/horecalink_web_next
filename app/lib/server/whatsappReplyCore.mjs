import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const millis = value => value?.toMillis?.() ?? value?.getTime?.() ?? 0;
export const incomingRevision = conversation => conversation?.lastIncomingRevision || String(millis(conversation?.lastIncomingAt));
export function replyError(message, status = 400) { return Object.assign(new Error(message), { status }); }
export function validateReply(body) {
  if (!body || !['draft', 'send'].includes(body.action)) throw replyError('İşlem geçersiz.');
  if (body.action === 'draft' && !['tr', 'ru', 'kk', 'en'].includes(body.language)) throw replyError('Dil seçin.');
  if (body.action === 'send' && (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096 ||
    !/^[a-f0-9-]{36}$/.test(body.requestId || '') || body.reviewed !== true || !Number.isSafeInteger(body.baseIncomingAt) || typeof body.baseRevision !== 'string' || body.baseRevision.length > 64)) throw replyError('Metni ve alıcıyı kontrol ederek gönderimi onaylayın.');
  return body;
}
export function assertSendable(conversation, base, phoneId, now = Date.now()) {
  const last = millis(conversation.lastIncomingAt);
  if (conversation.phoneNumberId !== phoneId || !/^\d{5,20}$/.test(conversation.senderId || '')) throw replyError('Gönderici numarası yapılandırmayla eşleşmiyor.', 409);
  if (last !== base) throw replyError('Yeni mesaj geldi. Mesajları yenileyip yanıtınızı yeniden inceleyin.', 409);
  if (!last || now < last || now - last >= 86400000) throw replyError('Yanıt süresi doldu. Müşteriden yeni bir mesaj bekleyin.', 409);
  if (conversation.pendingSendId) throw replyError('Önceki gönderim sürüyor veya sonucu belirsiz. Tekrar göndermeden önce WhatsApp üzerinden kontrol edin.', 409);
}
export function parseDraft(response) {
  if (response.status !== 'completed') throw replyError('Taslak tamamlanamadı. Elle yanıt yazabilirsiniz.', 502);
  const content = (response.output || []).flatMap(item => item.content || []);
  if (content.some(item => item.type === 'refusal')) throw replyError('Bu mesaj için taslak hazırlanamadı.', 422);
  let value;
  try { value = JSON.parse(content.filter(item => item.type === 'output_text').map(item => item.text).join('')); }
  catch { throw replyError('Taslak okunamadı.', 502); }
  if (typeof value.reply !== 'string' || !value.reply.trim() || value.reply.length > 4096) throw replyError('Taslak geçersiz.', 502);
  return value.reply.trim();
}

// Do not persist upstream error messages/details: they may contain credentials or customer data.
export function safeSendDiagnostics(status, error) {
  const numeric = value => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647 ? value : null;
  return { httpStatus: numeric(status), code: numeric(error?.code), subcode: numeric(error?.error_subcode) };
}

// This exception is limited to the verified Meta TEST sender. Never normalize all +7 numbers.
export function resolveReplyRecipient(conversation, rawMap) {
  const canonical = conversation.senderId;
  if (conversation.phoneNumberId !== '1298404383366536' || !rawMap) return canonical;
  let mapping;
  try {
    if (typeof rawMap !== 'string' || rawMap.length > 2048) throw new Error();
    mapping = JSON.parse(rawMap);
    if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object' || Object.keys(mapping).length > 10 ||
        Object.entries(mapping).some(([from, to]) => !/^\d{5,20}$/.test(from) || typeof to !== 'string' || !/^\d{5,20}$/.test(to))) throw new Error();
  } catch { throw replyError('Test alıcısı eşlemesi geçersiz. Yönetici ayarını kontrol edin.', 503); }
  return Object.hasOwn(mapping, canonical) ? mapping[canonical] : canonical;
}
