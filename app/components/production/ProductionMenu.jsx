'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { getProductionCopy } from '../../lib/production';
import ProductionIcon from './ProductionIcon';

export default function ProductionMenu({ mobile = false, onNavigate }) {
  const { lang } = useLang();
  const c = getProductionCopy(lang);
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const id = useId();
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div ref={root} className={mobile ? 'relative' : 'static'} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className={`inline-flex items-center justify-between gap-2 rounded-xl px-3 py-3 font-semibold transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d3246] ${mobile ? 'w-full' : 'text-sm'} ${pathname.startsWith('/production') ? 'text-[#286452]' : 'text-slate-700'}`}>
      {c.nav}<ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div id={id} className={mobile ? 'mt-2 grid gap-2 rounded-2xl bg-slate-50 p-2' : 'absolute left-1/2 top-full z-50 mt-3 grid w-[580px] -translate-x-1/2 grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl'}>
      {['stainless', 'packaging'].map(group => <Link key={group} href={`/production/${group}`} onClick={() => { setOpen(false); onNavigate?.(); }} className="group rounded-xl p-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#1d3246]">
        <ProductionIcon group={group} className={mobile ? 'mb-2 h-14 w-20' : 'mb-4 h-20 w-28'} />
        <span className="flex items-start justify-between gap-3 text-sm font-bold leading-5 text-[#1d3246]">{c[group]}<ArrowUpRight size={18} className="shrink-0" /></span>
        <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">{(group === 'stainless' ? c.steelOptions : c.packOptions).slice(0, 3).join(' · ')}</span>
      </Link>)}
    </div>}
  </div>;
}
