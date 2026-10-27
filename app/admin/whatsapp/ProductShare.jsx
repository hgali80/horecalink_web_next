'use client';
/* eslint-disable @next/next/no-img-element -- Authenticated generated JPEG data, not a public Next image URL. */
import { useEffect, useRef, useState } from 'react';

export default function ProductShare({ product, language, mode, card, disabled, readInbox, onMode, onPrepared, onInvalidate }) {
  const [showPrice, setShowPrice] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function prepare() {
    setBusy(true); setError(''); onInvalidate();
    try {
      const options = { productId: product.id, language, showPrice };
      const result = await readInbox('/api/admin/whatsapp/products/card', undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
      if (mounted.current) onPrepared({ ...result, ...options });
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" aria-label="Ürün paylaşımı">
    <label className="block text-xs font-semibold text-slate-600">Paylaşım biçimi<select className="ml-2 rounded-lg border p-2 text-xs" value={mode} disabled={disabled || busy} onChange={event => { setError(''); onMode(event.target.value); }}><option value="text">Yalnızca mesaj</option><option value="link">Ürün bağlantısı</option><option value="image">Görsel ürün kartı</option><option value="image_link">Görsel + ürün bağlantısı</option></select></label>
    {['image', 'image_link'].includes(mode) && <><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showPrice} disabled={disabled || busy} onChange={event => { setShowPrice(event.target.checked); onInvalidate(); }} />Kartta sitedeki liste fiyatını göster</label><p className="text-[11px] text-slate-500">Müşteriye özel teklif fiyatı bu karta aktarılmaz. Teknik metinler ürün kaydındaki dilde gösterilir; otomatik çevrilmez.</p><button type="button" disabled={disabled || busy} onClick={prepare} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">{busy ? 'Kart hazırlanıyor…' : 'Kartı hazırla ve önizle'}</button>{card && <img src={card.image} width={1080} height={1240} alt={`${card.productName} — müşteriye gönderilecek ürün kartı`} className="max-h-[440px] w-auto max-w-full rounded-lg border" />}</>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>;
}
