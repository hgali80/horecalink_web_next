export const TASKS = 'crm_followups';
export const ZONE = 'Asia/Qyzylorda';
export function invalid(message, status = 400) { return Object.assign(new Error(message), { status }); }
export function field(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw invalid('Alan eksik veya çok uzun.');
  return value.trim();
}
export function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw invalid('Kayıt kimliği geçersiz.');
  return value;
}
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw invalid('Takip tarihi geçersiz.');
  const result = new Date(value);
  if (result.toISOString() !== value || result.getUTCFullYear() < 2020 || result.getUTCFullYear() > 2100) throw invalid('Takip tarihi geçersiz.');
  return result;
}
export function validateCreate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Takip kaydı geçersiz.');
  if (!['offer', 'silent', 'callback'].includes(body.kind)) throw invalid('Takip türü geçersiz.');
  return {
    title: field(body.title, 160, true), customerName: field(body.customerName, 160, true),
    phone: field(body.phone || '', 40), notes: field(body.notes || '', 2000), kind: body.kind,
    dueAt: date(body.dueAt), customerId: body.customerId ? identifier(body.customerId) : '',
    offerId: body.offerId ? identifier(body.offerId) : '', conversationId: body.conversationId ? identifier(body.conversationId) : '',
  };
}
export function validateChange(body) {
  const id = identifier(body?.id);
  const revision = identifier(body?.revision);
  if (!['complete', 'cancel', 'reschedule', 'reopen'].includes(body.action)) throw invalid('İşlem geçersiz.');
  return { id, revision, action: body.action, ...(body.action === 'reschedule' || body.action === 'reopen' ? { dueAt: date(body.dueAt) } : {}) };
}
export function transition(task, change, now) {
  if (task.revision !== change.revision) throw invalid('Kayıt başka bir yerde değişti. Listeyi yenileyin.', 409);
  if (change.action === 'reopen' ? task.status === 'open' : task.status !== 'open') throw invalid('Görevin durumu değişti. Listeyi yenileyin.', 409);
  return { status: change.action === 'complete' ? 'completed' : change.action === 'cancel' ? 'cancelled' : 'open',
    ...(change.dueAt ? { dueAt: change.dueAt } : {}), closedAt: ['complete', 'cancel'].includes(change.action) ? now : null };
}
export function dayKey(value) { return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); }
export function taskBucket(task, now = new Date()) {
  if (task.status !== 'open') return 'closed';
  const day = dayKey(task.dueAt), today = dayKey(now);
  return day < today ? 'overdue' : day === today ? 'today' : 'upcoming';
}
