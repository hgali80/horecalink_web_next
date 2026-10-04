export class MetaCatalog {
  constructor({ token, catalogId = '1610542617193791', version = 'v26.0', fetchImpl = fetch } = {}) {
    if (!token) throw new Error('META_CATALOG_ACCESS_TOKEN sunucu secret eksik.');
    if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(catalogId)) throw new Error('Meta yapılandırması geçersiz.');
    this.token = token; this.catalogId = catalogId; this.base = `https://graph.facebook.com/${version}`; this.fetch = fetchImpl;
  }
  async request(path, method = 'GET', data) {
    const response = await this.fetch(`${this.base}/${path}`, {
      method, headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(20000), cache: 'no-store',
    });
    const body = await response.json();
    if (!response.ok || body.error) throw new Error(`Meta Catalog isteği başarısız (HTTP ${response.status}, kod ${body.error?.code ?? 'unknown'}).`);
    return body;
  }
  async find(sku) {
    const filter = encodeURIComponent(JSON.stringify({ retailer_id: { eq: sku } }));
    const result = await this.request(`${this.catalogId}/products?fields=id,retailer_id&filter=${filter}&limit=2`);
    if (result.data?.length > 1) throw new Error('Meta kataloğunda aynı SKU için birden fazla ürün var.');
    return result.data?.[0]?.id || null;
  }
  async sync(sku, payload) {
    const id = await this.find(sku);
    if (!payload) { if (id) await this.request(id, 'DELETE'); return { id: null, action: 'DELETE' }; }
    if (id) {
      const withoutPrice = !Object.hasOwn(payload, 'price');
      // Omission on UPDATE could preserve a previous price. Explicitly clear it
      // and verify the result; never report success with a stale customer price.
      await this.request(id, 'POST', withoutPrice ? { ...payload, price: null, sale_price: null } : payload);
      if (withoutPrice) {
        const stored = await this.request(`${id}?fields=price,sale_price`);
        if ([stored.price, stored.sale_price].some(value => value != null && String(value).trim() !== '')) {
          throw new Error('Meta eski fiyatı kaldırmadı. Fiyatsız yayın doğrulanamadı.');
        }
      }
      return { id, action: 'UPDATE' };
    }
    const created = await this.request(`${this.catalogId}/products`, 'POST', payload);
    if (!created.id) throw new Error('Meta ürün kimliği dönmedi.');
    return { id: created.id, action: 'CREATE' };
  }
}
