'use client';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { getProductionCopy } from '../../lib/production';
import ProductionIcon from './ProductionIcon';

export default function ProductionCatalogBanner({ group, category, subcategory }) {
  const { lang } = useLang();
  const c = getProductionCopy(lang);
  const productionGroup = ['paslanmaz', 'stainless-steel'].includes(group) ? 'stainless' : group === 'institutional' && (category === 'packaging-products' || ['cop-torbasi-ve-posetler', 'garbage-bags-and-liners'].includes(subcategory)) ? 'packaging' : null;
  if (!productionGroup) return null;
  return <Link href={`/production/${productionGroup}`} className="mb-6 flex items-center gap-4 rounded-2xl border border-[#286452]/15 bg-[#edf5f1] p-4 text-[#1d3246] transition hover:border-[#286452]/50 sm:p-5"><ProductionIcon group={productionGroup} className="hidden h-16 w-20 shrink-0 sm:block"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#286452]">{c.nav}</p><p className="mt-1 text-base font-bold sm:text-lg">{c[productionGroup]}</p><p className="mt-1 text-sm text-slate-600">{c.quote}</p></div><ArrowUpRight size={22} className="shrink-0"/></Link>;
}
