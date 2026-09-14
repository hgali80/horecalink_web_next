'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Factory } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { getProductionCopy, localized, packagingFamilies, packagingSpecifications, stainlessFamilies } from '../../lib/production';
import ProductionIcon from './ProductionIcon';
import ProductionRequestForm from './ProductionRequestForm';

const button = 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-4';

export default function ProductionPage({ group, familySlug }) {
  const { lang, t } = useLang();
  const c = getProductionCopy(lang);
  const packaging = group === 'packaging';
  const family = packagingFamilies.find(item => packaging && item.slug === familySlug);
  const title = family ? localized(family.name, lang) : c[group];
  const intro = family ? localized(family.description, lang) : c[`${group}Intro`];
  const cover = packaging ? `/images/production/${family?.image || 'packing'}.webp` : '/images/operations/stainless.jpg';
  const familySpecs = family?.specs || packagingSpecifications[familySlug];
  const options = familySpecs ? localized(familySpecs, lang) : packaging ? c.packOptions : c.steelOptions;
  const catalog = family?.catalog || (packaging ? '/catalog/institutional/packaging-products' : '/catalog/paslanmaz');
  return <main className="min-h-screen bg-[#f7f8fa] pb-24 text-[#1d3246] md:pb-12">
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <nav aria-label={t('breadcrumb.home')} className="flex flex-wrap items-center gap-2 text-xs leading-5 text-slate-500"><Link href="/" className="hover:underline">{t('breadcrumb.home')}</Link><ChevronRight size={13}/><Link href="/production" className="hover:underline">{c.nav}</Link>{family && <><ChevronRight size={13}/><Link href="/production/packaging" className="hover:underline">{c.packaging}</Link></>}<ChevronRight size={13}/><span aria-current="page">{title}</span></nav>
      <section className="grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-14 lg:py-14">
        <div><span className="inline-flex items-center gap-2 rounded-full border border-[#286452]/20 bg-[#eaf3ee] px-3 py-1.5 text-xs font-semibold text-[#286452]"><Factory size={14}/>{c.badge}</span><h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight lg:text-5xl">{title}</h1><p className="mt-6 max-w-xl text-base leading-7 text-slate-600">{intro}</p><div className="mt-7 flex flex-wrap gap-3"><a href="#request" className={`${button} bg-[#1d3246] text-white hover:bg-[#304c65]`}>{c.quote}<ArrowUpRight size={18}/></a><a href={family ? '#specifications' : '#families'} className={`${button} border border-slate-300 bg-white hover:bg-slate-100`}>{family ? c.specs : c.groups}<ArrowRight size={18}/></a></div></div>
        <div className="relative h-72 overflow-hidden rounded-3xl bg-slate-200 sm:h-96 lg:h-[440px]"><Image src={cover} alt={title} fill priority sizes="(max-width: 1023px) 100vw, 50vw" className="object-cover"/><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-6 pb-6 pt-16"><p className="text-xs font-semibold tracking-[0.2em] text-white">HORECALINK / {c.nav}</p></div></div>
      </section>

      {!family && <section id="families" className="scroll-mt-40 py-10"><h2 className="mb-7 text-3xl font-bold tracking-tight">{c.groups}</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(packaging ? packagingFamilies : stainlessFamilies).map((item, index) => <Link key={item.slug} href={packaging ? `/production/packaging/${item.slug}` : `/catalog/paslanmaz/${item.category}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#286452]">
          {packaging ? <div className="relative h-56 overflow-hidden"><Image src={`/images/production/${item.image}.webp`} alt={localized(item.name, lang)} fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105"/></div> : <div className="flex items-center justify-between bg-[#edf2f6] p-6"><ProductionIcon group="stainless"/><span className="text-4xl font-light text-slate-300">0{index + 1}</span></div>}
          <div className="p-6"><h3 className="text-xl font-bold leading-snug">{localized(item.name, lang)}</h3>{item.description && <p className="mt-3 text-sm leading-6 text-slate-500">{localized(item.description, lang)}</p>}<span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#286452]">{packaging ? c.discover : c.catalog}<ArrowUpRight size={17}/></span></div>
        </Link>)}
      </div></section>}

      <section id="specifications" className="my-10 scroll-mt-40 rounded-3xl border border-slate-200 bg-white p-6 sm:p-10"><div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]"><div><h2 className="text-3xl font-bold tracking-tight">{c.options}</h2><p className="mt-4 text-sm leading-7 text-slate-500">{c.optionsIntro}</p><Link href={catalog} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#286452]">{c.catalog}<ArrowUpRight size={18}/></Link></div><ul className="grid content-center gap-3 sm:grid-cols-2">{options.map(option => <li key={option} className="flex items-center gap-3 rounded-xl bg-[#f4f7f6] p-4 text-sm font-semibold"><Check size={18} className="shrink-0 text-[#286452]"/>{option}</li>)}</ul></div></section>

      <section className="py-10"><h2 className="text-3xl font-bold tracking-tight">{c.use}</h2><div className="mt-6 flex flex-wrap gap-3">{(packaging ? c.packUses : c.steelUses).map(use => <span key={use} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm">{use}</span>)}</div></section>
      <section className="py-10"><h2 className="text-3xl font-bold tracking-tight">{c.process}</h2><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{c.steps.map((step, index) => <div key={step} className="border-t border-slate-300 pt-5"><span className="text-sm font-bold text-[#286452]">0{index + 1}</span><h3 className="mt-3 text-lg font-bold">{step}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{c.stepTexts[index]}</p></div>)}</div></section>
      <section className="py-10"><h2 className="text-3xl font-bold tracking-tight">{c.gallery}</h2><p className="mt-3 text-sm text-slate-500">{c.galleryIntro}</p><div className="mt-6 grid grid-cols-2 gap-4">{(packaging ? ['production', family?.image === 'film' ? 'packing' : 'film'] : ['stainless', 'project']).map(item => <div key={item} className="relative h-56 overflow-hidden rounded-2xl sm:h-80"><Image src={packaging ? `/images/production/${item}.webp` : `/images/operations/${item}.jpg`} alt={`${c.gallery} — ${c[group]}`} fill sizes="50vw" className="object-cover"/></div>)}</div></section>
      <section className="py-10"><h2 className="mb-6 text-3xl font-bold tracking-tight">{c.faq}</h2><div className="divide-y divide-slate-200">{c.questions.map((question, index) => <details key={question} className="group py-5"><summary className="cursor-pointer text-base font-semibold">{question}</summary><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{c.answers[index]}</p></details>)}</div></section>
      <ProductionRequestForm key={`${group}-${familySlug || 'all'}`} group={group} family={family}/>
      {family && <section className="pt-12"><h2 className="text-xl font-bold">{c.related}</h2><div className="mt-5 flex flex-wrap gap-3">{packagingFamilies.filter(item => item.slug !== family.slug).map(item => <Link key={item.slug} href={`/production/packaging/${item.slug}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:border-[#286452]">{localized(item.name, lang)}</Link>)}</div></section>}
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500"><Link href="/" className="font-bold text-[#1d3246]">HorecaLink</Link><Link href={`/production/${packaging ? 'stainless' : 'packaging'}`} className="hover:underline">{packaging ? c.stainless : c.packaging} →</Link><Link href="/contact">{t('header.menu.contact')}</Link></footer>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden"><a href="#request" className="block rounded-xl bg-[#286452] px-4 py-3 text-center text-sm font-bold text-white">{c.quote}</a></div>
  </main>;
}
