import { digest, millis, replyError } from './whatsappReplyCore.mjs';

export const PREFERENCES = 'crm_contact_preferences';
export const TASKS = 'crm_followups';
export function followupId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw replyError('Takip kaydı geçersiz.');
  return value;
}
export function checkTask(task, conversationId, revision) {
  if (!task || task.conversationId !== conversationId) throw replyError('Takip bu WhatsApp görüşmesine bağlı değil.', 409);
  if (task.status !== 'open') throw replyError('Bu takip kapalı. Önce takip kaydını kontrol edin.', 409);
  if (revision && task.revision !== revision) throw replyError('Takip kaydı değişti. Takip bilgisini yenileyin.', 409);
}
export function checkPermission(preferences, expectedRevision) {
  if (preferences?.status !== 'granted') throw replyError('Müşterinin takip mesajı izni kayıtlı değil veya geri çekilmiş.', 409);
  if (expectedRevision && preferences.revision !== expectedRevision) throw replyError('İletişim izni değişti. Yeniden kontrol edin.', 409);
}
export function assertTemplateConversation(conversation, body, phoneId) {
  if (!conversation || conversation.phoneNumberId !== phoneId || !/^\d{5,20}$/.test(conversation.senderId || '')) throw replyError('Gönderici numarası yapılandırmayla eşleşmiyor.', 409);
  const revision = conversation.lastIncomingRevision || String(millis(conversation.lastIncomingAt));
  if (millis(conversation.lastIncomingAt) !== body.baseIncomingAt || revision !== body.baseRevision) throw replyError('Yeni müşteri mesajı var. Görüşmeyi yenileyip tekrar inceleyin.', 409);
  if (conversation.pendingSendId) throw replyError('Önceki gönderimin sonucu netleşmeden yeni mesaj gönderilemez.', 409);
}
export async function draftContext(db, taskId, conversationId, revision) {
  const task = (await db.collection(TASKS).doc(followupId(taskId)).get()).data();
  checkTask(task, conversationId, revision);
  let offerNumber = '';
  if (task.offerId) {
    const offer = (await db.collection('commercial_offers').doc(followupId(task.offerId)).get()).data();
    if (!offer) throw replyError('Bağlı teklif bulunamadı. Takibi kontrol edin.', 409);
    offerNumber = String(offer.offerNo || '').slice(0, 80);
  }
  // Private CRM notes/title, contact fields, internal IDs and monetary assumptions never enter AI input.
  return { revision: task.revision, input: { kind: task.kind, ...(offerNumber ? { offerNumber } : {}) } };
}
export function checkCooldown(task, now = Date.now()) {
  const last = millis(task.lastFollowupSentAt);
  if (last && now - last < 86400000) throw replyError('Bu takip için son 24 saatte mesaj kabul edilmiş. Önce müşterinin dönüşünü kontrol edin.', 409);
}
export function consentBody(body) {
  if (!body || !['granted', 'revoked'].includes(body.status) || typeof body.revision !== 'string' || body.revision.length > 128) throw replyError('İletişim izni kaydı geçersiz.');
  if (body.confirmed !== true || typeof body.source !== 'string' || body.source.trim().length < 3 || body.source.length > 500) throw replyError('İzin veya iptal kaynağını yazın ve kaydı onaylayın.');
  return { status: body.status, source: body.source.trim(), revision: body.revision };
}
export const templateRevision = value => digest(JSON.stringify(value));
export function normalizeTemplate(data) {
  if (!data || data.status !== 'APPROVED' || !/^\d{1,40}$/.test(data.id || '') || !/^[a-z0-9_]{1,512}$/.test(data.name || '') || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(data.language || '') || !['MARKETING', 'UTILITY'].includes(data.category)) return null;
  if (!Array.isArray(data.components) || data.components.some(component => !['BODY', 'HEADER', 'FOOTER'].includes(component.type))) return null;
  if (data.parameter_format && data.parameter_format !== 'POSITIONAL') return null;
  const bodies = data.components.filter(component => component.type === 'BODY');
  if (bodies.length !== 1 || typeof bodies[0].text !== 'string' || bodies[0].text.length > 4096) return null;
  const header = data.components.find(component => component.type === 'HEADER'), footer = data.components.find(component => component.type === 'FOOTER');
  if (header && (header.format !== 'TEXT' || typeof header.text !== 'string' || /\{\{/.test(header.text))) return null;
  if (footer && (typeof footer.text !== 'string' || /\{\{/.test(footer.text))) return null;
  const text = bodies[0].text, matches = [...text.matchAll(/\{\{(\d+)\}\}/g)].map(match => Number(match[1]));
  if (/\{\{|\}\}/.test(text.replace(/\{\{\d+\}\}/g, ''))) return null;
  const count = matches.length ? Math.max(...matches) : 0;
  if (count > 8 || matches.some(value => value < 1) || Array.from({ length: count }, (_, i) => i + 1).some(value => !matches.includes(value))) return null;
  const template = { id: data.id, name: data.name, language: data.language, category: data.category, body: text, header: header?.text || '', footer: footer?.text || '', parameterCount: count };
  return { ...template, revision: templateRevision(template) };
}
export function renderTemplate(template, parameters) {
  if (!Array.isArray(parameters) || parameters.length !== template.parameterCount || parameters.some(value => typeof value !== 'string' || !value.trim() || value.length > 200 || /[\r\n\u0000-\u001f]/.test(value))) throw replyError('Şablondaki bütün alanları doldurun (alan başına en fazla 200 karakter).');
  const body = template.body.replace(/\{\{(\d+)\}\}/g, (_, index) => parameters[Number(index) - 1]);
  const result = [template.header, body, template.footer].filter(Boolean).join('\n\n');
  if (result.length > 4096) throw replyError('Şablon metni çok uzun.');
  return result;
}
export function templateRequest(body) {
  if (!body || body.action !== 'send_template' || body.reviewed !== true || !/^[a-f0-9-]{36}$/.test(body.requestId || '') || !/^\d{1,40}$/.test(body.templateId || '') || !/^[a-z0-9_]{1,512}$/.test(body.templateName || '') || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(body.templateLanguage || '') || !/^[a-f0-9]{64}$/.test(body.templateRevision || '') || typeof body.reviewedText !== 'string' || !body.reviewedText.trim() || body.reviewedText.length > 4096 || !Number.isSafeInteger(body.baseIncomingAt) || typeof body.baseRevision !== 'string' || body.baseRevision.length > 64 || typeof body.reviewedRecipient !== 'string' || !/^\d{5,20}$/.test(body.reviewedRecipient) || !Array.isArray(body.parameters) || body.parameters.length > 8 || body.parameters.some(value => typeof value !== 'string' || value.length > 200)) throw replyError('Şablonu, alanları ve alıcıyı kontrol ederek onaylayın.');
  followupId(body.followupId); followupId(body.followupRevision); followupId(body.permissionRevision);
  return body;
}
