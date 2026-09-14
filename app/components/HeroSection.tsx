"use client";

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { getProductionCopy } from '../lib/production';

export default function HeroSection() {
  const { t, lang } = useLang();
  const c = getProductionCopy(lang);
  const router = useRouter();
  const [q, setQ] = useState('');
  const search = (event: FormEvent) => { event.preventDefault(); if (q.trim()) router.push('/products?q=' + encodeURIComponent(q.trim())); };
  return <section className="border-b border-slate-200 bg-[#edf1f3]">
    <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:px-8 lg:py-14">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#286452]">HORECALINK / {c.nav}</p><h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-[#1d3246] sm:text-5xl xl:text-6xl">{c.homeTitle}</h1><p className="mt-5 max-w-xl text-base leading-7 text-slate-600">{c.homeIntro}</p><div className="mt-6 flex flex-wrap gap-3"><a href="#production" className="inline-flex items-center gap-2 rounded-xl bg-[#1d3246] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#304c65]">{c.discover}<ArrowUpRight size={18}/></a><Link href="/catalog" className="rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-[#1d3246] hover:bg-slate-50">{c.all}</Link></div>
        <form role="search" onSubmit={search} className="mt-7 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"><Search size={19} className="ml-2 shrink-0 text-slate-400"/><input value={q} onChange={event => setQ(event.target.value)} type="search" name="q" aria-label={t('home.hero.search.placeholder')} placeholder={t('home.hero.search.placeholder')} className="min-w-0 flex-1 rounded px-1 py-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-[#286452]"/><button type="submit" className="rounded-lg bg-[#1d3246] px-4 py-3 text-sm font-bold text-white hover:bg-[#304c65]">{t('home.hero.search.button')}</button></form>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        {(['stainless', 'packaging'] as const).map((group, index) => <Link key={group} href={'/production/' + group} className={'group relative h-40 overflow-hidden rounded-2xl bg-slate-300 sm:h-56 lg:h-80 ' + (index ? 'lg:mt-12' : '')}><Image src={group === 'stainless' ? '/images/operations/stainless.jpg' : '/images/production/production.webp'} alt={c[group]} fill priority sizes="(max-width: 1023px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105"/><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 text-sm font-bold leading-snug text-white">{c[group]}</span></Link>)}
      </div>
    </div>
  </section>;
}
