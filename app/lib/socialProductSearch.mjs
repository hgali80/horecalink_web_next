export function normalizeProductSearch(value) {
  return String(value ?? '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
}
export function filterSocialProducts(products, query) {
  const words = normalizeProductSearch(query).split(' ').filter(Boolean);
  if (!words.length) return products;
  return products.filter(product => {
    const text = normalizeProductSearch([product.sku, product.stock_code, product.manufacturerCode, product.name, product.name_ru, product.name_tr, product.name_en, product.name_kk, product.brand].join(' '));
    return words.every(word => text.includes(word));
  });
}
export function socialProductLabel(product) {
  if (!product) return '';
  return [product.sku || product.stock_code, product.name_ru || product.name || product.name_tr].filter(Boolean).join(' · ');
}
