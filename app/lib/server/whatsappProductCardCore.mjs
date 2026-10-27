import { createHash } from 'node:crypto';
import { getStoredProductImageNames } from '../productImageNames.mjs';

const clean = (value, max = 240) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const hash = value => createHash('sha256').update(value).digest('hex');
export const CARD_LABELS = {
  ru: { details: 'Характеристики', price: 'Цена по запросу', site: 'Подробнее на сайте', code: 'Код' },
  kk: { details: 'Сипаттамалары', price: 'Бағасын нақтылаңыз', site: 'Толығырақ сайтта', code: 'Коды' },
  tr: { details: 'Teknik bilgiler', price: 'Fiyat için bilgi alın', site: 'Ayrıntılar web sitemizde', code: 'Ürün kodu' },
  en: { details: 'Specifications', price: 'Contact us for pricing', site: 'More details on our website', code: 'Product code' },
};
export function cardError(message, status = 400) { return Object.assign(new Error(message), { status }); }
export function cardOptions(body) {
  if (!body || typeof body.productId !== 'string' || !body.productId || body.productId.length > 128 || /[\\/]/.test(body.productId) || !Object.hasOwn(CARD_LABELS, body.language) || typeof body.showPrice !== 'boolean') throw cardError('Ürün kartı seçimi geçersiz.');
  return { productId: body.productId, language: body.language, showPrice: body.showPrice };
}
export function cardFacts(id, data, options) {
  if (!data || data.active !== true || data.webPublished !== true) throw cardError('Ürün artık sitede yayında değil.', 409);
  const image = getStoredProductImageNames(data)[0];
  if (!image || image.length > 240 || /[\\/]/.test(image) || /[\u0000-\u001f]/.test(image)) throw cardError('Bu ürün için geçerli bir fotoğraf bulunamadı.', 409);
  const localized = data[`name_${options.language}`];
  const specs = data[`specs_${options.language}`] || data.specs || '';
  const lines = String(specs).split(/[\n\r]+/).map(value => clean(value, 160)).filter(Boolean).slice(0, 4);
  const price = Number(data.price);
  return { version: 1, productId: id, language: options.language, showPrice: options.showPrice,
    name: clean(localized || data.name_ru || data.name, 160), sku: clean(data.sku || data.stock_code || id, 80), brand: clean(data.brand, 80),
    specs: lines, price: options.showPrice && Number.isFinite(price) && price > 0 ? price : null,
    imageUrl: `https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/${encodeURIComponent(`product_images/${image}`)}?alt=media`,
    url: `https://horecalink.kz/products/${encodeURIComponent(data.slug || id)}` };
}
export const factsRevision = facts => hash(JSON.stringify(facts));
export const imageRevision = (facts, image) => hash(Buffer.concat([Buffer.from(factsRevision(facts)), image]));
export function xml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]); }
export function wrap(value, max, limit) {
  const words = String(value).split(/\s+/), lines = []; let line = '';
  for (const word of words) {
    for (const part of word.match(new RegExp(`.{1,${max}}`, 'gu')) || []) {
      if (line && [...`${line} ${part}`].length > max) { lines.push(line); line = part; } else line = line ? `${line} ${part}` : part;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, limit).map((item, index) => index === limit - 1 && lines.length > limit ? `${item.slice(0, -1)}…` : item);
}
export function cardSvg(facts, photoDataUri) {
  const label = CARD_LABELS[facts.language];
  const title = wrap(facts.name, 38, 2).map((line, i) => `<text x="56" y="${745 + i * 49}" font-size="40" font-weight="700">${xml(line)}</text>`).join('');
  const details = facts.specs.flatMap(line => wrap(line, 76, 2)).slice(0, 4).map((line, i) => `<text x="56" y="${909 + i * 34}" font-size="25" fill="#475569">${xml(line)}</text>`).join('');
  const price = facts.showPrice ? (facts.price ? `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(facts.price)} ₸` : label.price) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1240"><rect width="1080" height="1240" fill="#f5f7fb"/><g font-family="DejaVu Sans,Arial,sans-serif" fill="#19364b"><rect width="1080" height="114" fill="#19364b"/><text x="56" y="74" fill="#fff" font-size="49" font-weight="700">HorecaLink</text><text x="1024" y="68" text-anchor="end" fill="#d4e2ea" font-size="25">horecalink.kz</text><rect x="32" y="138" width="1016" height="540" rx="22" fill="#fff"/><image x="56" y="155" width="968" height="506" href="${photoDataUri}"/>${title}<text x="56" y="841" font-size="23" fill="#64748b">${xml(label.code)}: ${xml(facts.sku)}${facts.brand ? ` · ${xml(facts.brand)}` : ''}</text><text x="56" y="875" font-size="23" font-weight="700">${xml(label.details)}</text>${details}<line x1="56" x2="1024" y1="1060" y2="1060" stroke="#dce4ec"/><text x="56" y="1120" font-size="36" font-weight="700">${xml(price)}</text><text x="56" y="1190" font-size="23" fill="#64748b">${xml(label.site)} · horecalink.kz</text></g></svg>`;
}
