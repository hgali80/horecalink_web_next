'use client';
import { Factory } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { getProductionCopy, getProductionGroup } from '../../lib/production';

export default function ProductionBadge({ product }) {
  const { lang } = useLang();
  if (!getProductionGroup(product)) return null;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf3ee] px-2.5 py-1 text-[11px] font-semibold text-[#286452]"><Factory size={13} aria-hidden="true" />{getProductionCopy(lang).badge}</span>;
}
