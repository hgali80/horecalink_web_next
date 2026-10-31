export const CHANNELS = ['web', 'whatsapp', 'instagram', 'facebook'];
export const CHANNEL_LABELS = { web: 'Web', whatsapp: 'WhatsApp katalog', instagram: 'Instagram', facebook: 'Facebook' };
export const DEFAULT_SETTINGS = { mode: 'approval', paused: true, timezone: 'Asia/Almaty' };
export function productFacts(product, id) {
  return { name: String(product.name_ru || product.name || ''), sku: String(product.sku || ''), price: Number(product.price) || 0, slug: String(product.slug || id), active: product.active === true, brand: String(product.brand || ''), specs: String(product.specs || ''), material: String(product.material || ''), dimensions: String(product.dimensions || ''), capacity: String(product.capacity || ''), power: String(product.power || ''), voltage: String(product.voltage || ''), fuelType: String(product.fuelType || ''), warranty: String(product.warranty || '') };
}
export function invalid(message, status = 400) { return Object.assign(new Error(message), { status, safe: true }); }
export function validId(value) { return typeof value === 'string' && /^[^/\\\u0000-\u001f]{1,128}$/.test(value) && value !== '.' && value !== '..'; }
export function normalizeDraft(body, now = Date.now()) {
  if (!validId(body?.productId)) throw invalid('Ürün seçin.');
  const channels = CHANNELS.filter(channel => body.channels?.includes(channel));
  if (!channels.length || !Array.isArray(body.channels) || channels.length !== body.channels.length) throw invalid('Geçerli yayın kanalları seçin.');
  const scheduledAt = Date.parse(body.scheduledAt);
  if (!Number.isFinite(scheduledAt) || scheduledAt < now - 60000 || scheduledAt > now + 366 * 86400000) throw invalid('Takvim zamanı geçersiz; gelecek bir tarih seçin.');
  const media = {}, captions = {};
  for (const channel of channels) {
    const selection = body.media?.[channel] || { source: 'web' };
    if (!['web', 'custom'].includes(selection.source)) throw invalid('Görsel kaynağı geçersiz.');
    if (selection.source === 'custom' && !validId(selection.assetId)) throw invalid('Özel görseli yükleyin.');
    media[channel] = selection.source === 'web' ? { source: 'web' } : { source: 'custom', assetId: selection.assetId };
    const caption = body.captions?.[channel] ?? '';
    if (typeof caption !== 'string' || caption.length > (channel === 'instagram' ? 2200 : 5000)) throw invalid('Yayın metni çok uzun.');
    captions[channel] = caption.trim();
  }
  return { productId: body.productId, channels, scheduledAt, media, captions };
}
export function approvalValid(post) { return post.approvedRevision === post.revision && post.approvedHash === post.contentHash; }
export function canClaim(post, job, settings, now) {
  return settings.paused !== true && job.status === 'queued' && job.nextAttemptAt <= now
    && post.status === 'scheduled' && job.revision === post.revision && approvalValid(post);
}
export function almatyToUtc(local) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw invalid('Takvim zamanı geçersiz.');
  const value = new Date(`${local}:00+05:00`);
  if (!Number.isFinite(value.getTime()) || new Date(value.getTime() + 5 * 3600000).toISOString().slice(0, 16) !== local) throw invalid('Takvim zamanı geçersiz.');
  return value.toISOString();
}
