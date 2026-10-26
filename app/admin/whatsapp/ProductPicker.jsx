'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, Package, X, ExternalLink } from 'lucide-react';

export default function ProductPicker({ readInbox, suggestion, selected, onSelect, disabled }) {
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState('');
  const [products,setProducts] = useState([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const cache = useRef(new Map());
  const mounted = useRef(true);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; }; },[]);
  const choose = async product => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result=await readInbox(`/api/admin/whatsapp/products?id=${encodeURIComponent(product.id)}`);
      if (mounted.current) { onSelect(result.product); setOpen(false); }
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  useEffect(() => {
    if (!open) return;
    const term = (query || suggestion || '').slice(0,1000);
    if (term.length < 3) { setProducts([]); return; }
    if (cache.current.has(term)) { setProducts(cache.current.get(term)); return; }
    const request = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const result = await readInbox(`/api/admin/whatsapp/products?q=${encodeURIComponent(term)}`,request.signal);
        if (request.signal.aborted) return;
        cache.current.set(term,result.products); setProducts(result.products);
      } catch (err) { if (!request.signal.aborted) { setProducts([]); setError(err.message); } }
      finally { if (!request.signal.aborted) setBusy(false); }
    },350);
    return () => { clearTimeout(timer); request.abort(); };
  },[open,query,suggestion,readInbox]);
  return <div>
    <button type="button" disabled={disabled} onClick={() => setOpen(value => !value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><Package size={15}/>{selected ? 'Ürünü değiştir' : 'Ürün önerileri'}</button>
    {selected && <div className="mt-3 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3"><Package size={22} className="shrink-0 text-orange-600"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{selected.name}</p><p className="text-xs text-slate-500">{selected.sku} · {selected.price ? `${selected.price.toLocaleString('tr-TR')} ₸` : 'Fiyat için bilgi alın'} · Sitedeki bilgi</p></div><a href={selected.url} target="_blank" rel="noreferrer" aria-label="Ürünü sitede aç" className="text-slate-500"><ExternalLink size={16}/></a><button type="button" disabled={disabled} aria-label="Ürün seçimini kaldır" onClick={() => onSelect(null)}><X size={16}/></button></div>}
    {open && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label className="flex items-center gap-2 rounded-lg border bg-white px-3"><Search size={15} className="text-slate-400"/><input aria-label="Ürün adı, kodu veya bağlantısı" value={query} onChange={event => setQuery(event.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Ürün adı, kodu veya bağlantısı"/></label>
      <p className="my-2 text-[11px] text-slate-500">Son müşteri mesajına göre öneriler · Ürünü sen seçersin. Stok ve teslimat varsayılmaz.</p>
      {busy && <p className="text-xs text-slate-500">Ürünler aranıyor…</p>}{error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{products.map(product => <button key={product.id} type="button" disabled={disabled || busy} onClick={() => choose(product)} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-orange-400"><Package size={20} className="shrink-0 text-orange-500"/><div className="min-w-0"><p className="line-clamp-2 text-xs font-semibold text-slate-800">{product.name}</p><p className="mt-1 text-[11px] text-slate-500">{product.sku} · {product.price ? `${product.price.toLocaleString('tr-TR')} ₸` : 'Fiyat sorunuz'}</p></div></button>)}</div>
      {!busy && !error && !products.length && <p className="p-3 text-xs text-slate-500">Eşleşme bulunamadı. Ürün adı veya koduyla arayabilirsin.</p>}
    </div>}
  </div>;
}
