'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterSocialProducts, socialProductLabel } from '@/app/lib/socialProductSearch.mjs';

export default function ProductSearch({ products, value, onChange, disabled, loading }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const [active, setActive] = useState(-1), [visibleCount, setVisibleCount] = useState(60);
  const root = useRef(null), list = useRef(null), input = useRef(null);
  const id = useId();
  const selected = products.find(product => product.id === value);
  const matches = useMemo(() => filterSocialProducts(products, query), [products, query]);
  useEffect(() => {
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => { if (open && active >= 0) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active, open]);
  function expand() { if (!open) { setQuery(''); setActive(-1); setVisibleCount(60); setOpen(true); } }
  function select(product) { onChange(product.id); setQuery(''); setOpen(false); setActive(-1); input.current?.focus(); }
  function keyDown(event) {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (!open) { expand(); return; }
      setActive(index => event.key === 'ArrowDown' ? Math.min(index + 1, matches.length - 1) : Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && open) { event.preventDefault(); const choice = matches[active >= 0 ? active : 0]; if (choice) select(choice); }
  }
  return <div ref={root} className="relative">
    <label htmlFor={`${id}-input`} className="mb-1 block text-sm font-medium">Ürün ara ve seç</label>
    <div className="relative">
      <input ref={input} id={`${id}-input`} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 && matches[active] ? `${id}-option-${active}` : undefined} autoComplete="off" disabled={disabled} value={open ? query : socialProductLabel(selected)} placeholder="Rusça / Türkçe ürün adı veya SKU yazın" onFocus={expand} onClick={expand} onChange={event => { setQuery(event.target.value); if (value) onChange(''); setActive(-1); setVisibleCount(60); setOpen(true); if (list.current) list.current.scrollTop = 0; }} onKeyDown={keyDown} onBlur={event => { if (!root.current?.contains(event.relatedTarget)) setOpen(false); }} className="w-full rounded-lg border bg-white py-3 pl-3 pr-12 text-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200 disabled:opacity-50" />
      <button type="button" aria-label={value ? 'Ürün seçimini temizle' : 'Ürün listesini aç'} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { if (value) onChange(''); setQuery(''); setActive(-1); setVisibleCount(60); setOpen(true); input.current?.focus(); }} className="absolute inset-y-0 right-0 px-4 text-slate-500">{value ? '×' : '⌄'}</button>
    </div>
    {open && <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <p role="status" className="border-b bg-slate-50 px-3 py-2 text-xs text-slate-500">{loading ? 'Web ürünleri yükleniyor…' : `${matches.length} ürün${query ? ' bulundu' : ' · Webde yayındaki tüm ürünler'}`}</p>
      <div ref={list} id={`${id}-list`} role="listbox" aria-label="Web ürünleri" className="max-h-80 overflow-y-auto overscroll-contain" onScroll={event => { const element = event.currentTarget; if (element.scrollHeight - element.scrollTop - element.clientHeight < 120) setVisibleCount(count => Math.min(count + 60, matches.length)); }}>
        {matches.slice(0, Math.max(visibleCount, active + 1)).map((product, index) => <div id={`${id}-option-${index}`} key={product.id} data-index={index} role="option" aria-selected={product.id === value} aria-posinset={index + 1} aria-setsize={matches.length} onMouseDown={event => event.preventDefault()} onClick={() => select(product)} className={`cursor-pointer border-b border-slate-100 px-3 py-3 text-sm last:border-0 hover:bg-slate-100 ${index === active ? 'bg-slate-100' : product.id === value ? 'bg-blue-50' : ''}`}>
          <span className="block font-medium text-slate-800">{socialProductLabel(product)}</span>
          {product.name_tr && product.name_tr !== (product.name_ru || product.name) && <span className="mt-1 block text-xs text-slate-500">{product.name_tr}</span>}
        </div>)}
        {!loading && !matches.length && <p className="p-5 text-sm text-slate-500">Eşleşen ürün bulunamadı.</p>}
      </div>
    </div>}
  </div>;
}
