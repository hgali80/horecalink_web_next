const normalize = value => String(value).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFKD').replace(/\p{M}/gu,'');
const synonyms = { masa:['стол','үстел'], tezgah:['стол','үстел'], evye:['мойка','раковина'], raf:['стеллаж','полка','сөре'], dolap:['шкаф','тоңазытқыш'], buzdolabi:['холодильник','тоңазытқыш'], firin:['печь','пеш'], ocak:['плита'], paslanmaz:['нержав','тот баспайтын'] };
export function suggestProducts(products, query) {
  const text = normalize(query).slice(0,1000);
  const terms = text.split(/[^\p{L}\p{N}]+/u).filter(term => term.length >= 3).slice(0,30);
  const expanded = [...new Set(terms.flatMap(term => [term,...(synonyms[term] || [])]))];
  return products.map(product => {
    const haystack = normalize(`${product.name} ${product.nameTr} ${product.nameKk} ${product.brand} ${product.specs}`);
    const exact = product.sku && new RegExp(`(^|[^0-9])${product.sku.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^0-9]|$)`).test(query);
    const link = text.includes(normalize(product.url));
    return { product, score:(exact ? 100 : 0) + (link ? 200 : 0) + expanded.reduce((sum,term) => sum + (haystack.includes(normalize(term)) ? 1 : 0),0) };
  }).filter(item => item.score > 0).sort((a,b) => b.score - a.score || a.product.name.localeCompare(b.product.name)).slice(0,6).map(item => item.product);
}
