import 'server-only';
import { normalizeTemplate } from './whatsappFollowupCore.mjs';
import { replyError } from './whatsappReplyCore.mjs';

export function templateConfig() {
  const version = process.env.WHATSAPP_GRAPH_API_VERSION, account = process.env.WHATSAPP_WABA_ID;
  if (!/^v\d+\.\d+$/.test(version || '') || !/^\d{1,40}$/.test(account || '') || !process.env.WHATSAPP_ACCESS_TOKEN) throw replyError('Meta şablon bağlantısı henüz yapılandırılmadı.', 503);
  return { version, account };
}
export async function listTemplates({ cursor = '', name = '' } = {}) {
  const { version, account } = templateConfig();
  if (typeof cursor !== 'string' || cursor.length > 2048 || (name && !/^[a-z0-9_]{1,512}$/.test(name))) throw replyError('Şablon sayfası geçersiz.');
  const url = new URL(`https://graph.facebook.com/${version}/${account}/message_templates`);
  url.searchParams.set('fields', 'id,name,language,status,category,components,parameter_format');
  url.searchParams.set('limit', name ? '100' : '30');
  if (cursor) url.searchParams.set('after', cursor);
  if (name) url.searchParams.set('name', name);
  let response, data;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
    data = await response.json();
  } catch { throw replyError('Meta şablon listesi alınamadı.', 502); }
  if (!response.ok || !Array.isArray(data.data) || data.data.length > 100) throw replyError('Meta şablonlarına erişilemedi. Hesap ve şablon okuma yetkisini kontrol edin.', 502);
  // Never follow a provider-supplied next URL containing credentials or another host.
  const nextCursor = data.paging?.next && typeof data.paging?.cursors?.after === 'string' && data.paging.cursors.after.length <= 2048 ? data.paging.cursors.after : null;
  return { templates: data.data.map(normalizeTemplate).filter(Boolean), nextCursor };
}
export async function approvedTemplate(body) {
  const page = await listTemplates({ name: body.templateName });
  const template = page.templates.find(item => item.id === body.templateId && item.name === body.templateName && item.language === body.templateLanguage);
  if (!template || template.revision !== body.templateRevision) throw replyError('Şablon değişmiş, onayı kalkmış veya bu hesapta bulunamamış. Listeyi yenileyin.', 409);
  return template;
}
