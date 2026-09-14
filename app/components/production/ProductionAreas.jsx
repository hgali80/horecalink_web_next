'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { getProductionCopy } from '../../lib/production';

export default function ProductionAreas({ standalone = false }) {
  const { lang } = useLang();
  const c = getProductionCopy(lang);
  const Heading = standalone ? 'h1' : 'h2';
  return <section id="production" className="mx-auto max-w-7xl scroll-mt-40 px-4 py-12 sm:px-6 lg:px-8">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><Heading className="text-3xl font-bold tracking-tight text-[#1d3246]">{c.areas}</Heading><p className="max-w-md text-sm leading-6 text-slate-500">{c.areasIntro}</p></div>
    <div className="grid gap-6 md:grid-cols-2">
      {['stainless', 'packaging'].map((group, index) => <Link href={`/production/${group}`} key={group} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1d3246]">
        <div className="relative h-56 overflow-hidden sm:h-64"><Image src={group === 'stainless' ? '/images/operations/stainless.jpg' : '/images/production/packing.webp'} alt={c[group]} fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-5 top-5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#1d3246]">{c.badge}</span></div>
        <div className="p-6 sm:p-8"><span className="text-xs font-semibold tracking-widest text-slate-400">0{index + 1} / HORECALINK</span><h3 className="mt-3 text-2xl font-bold leading-tight text-[#1d3246]">{c[group]}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{c[`${group}Intro`]}</p><span className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 text-sm font-bold text-[#1d3246]">{c.discover}<ArrowUpRight size={22} /></span></div>
      </Link>)}
    </div>
  </section>;
}
