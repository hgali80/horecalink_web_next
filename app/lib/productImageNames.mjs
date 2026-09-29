function cleanText(value) {
  const text = String(value ?? '').trim();
  return text.toLowerCase() === 'null' ? '' : text;
}

function withExtension(value) {
  const text = cleanText(value);
  return !text || /\.[a-z0-9]+$/i.test(text) ? text : `${text}.jpg`;
}

export function getStoredProductImageNames(product) {
  const names = Array.isArray(product?.image_names)
    ? product.image_names : cleanText(product?.image_names).split(/[\n,;]+/);
  const stored = names.map(withExtension).filter(Boolean);
  const fallback = cleanText(product?.imageBase).split(/[\n,;]+/).map(withExtension).filter(Boolean);
  return [...new Set(stored.length ? stored : fallback)];
}

export function getProductImageStems(product) {
  return [...new Set([
    product?.stock_code, product?.sku, product?.manufacturerCode, product?.imageBase, product?.id,
  ].map(value => cleanText(value).replace(/\.[a-z0-9]+$/i, '')).filter(Boolean))];
}

// Build once during maintenance/import, never during a public page request.
export function buildProductImageIndex(filenames) {
  const index = new Map();
  for (const name of [...new Set(filenames)].sort()) {
    const match = name.match(/^([^/\\]+)\.([a-z0-9]+)$/i);
    if (!match) continue;
    const stem = match[1];
    const numbered = stem.match(/^(.*)-(\d+)$/);
    const keys = [[stem, 0]];
    if (numbered?.[1]) keys.push([numbered[1], Number(numbered[2])]);
    for (const [key, order] of keys) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ name, order });
    }
  }
  for (const items of index.values()) items.sort((a, b) => a.order - b.order);
  return index;
}

export function mergeDiscoveredProductImageNames(product, index) {
  const discovered = getProductImageStems(product).flatMap(stem =>
    (index.get(stem) || []).map(item => item.name));
  return [...new Set([...getStoredProductImageNames(product), ...discovered])];
}
