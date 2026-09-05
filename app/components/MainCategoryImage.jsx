/* eslint-disable @next/next/no-img-element */
'use client';
import { useState } from 'react';
import { Sparkles, CookingPot, ChefHat } from 'lucide-react';
import { CATEGORY_COLORS } from '@/app/lib/categoryImages';
export default function MainCategoryImage({ src, group }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const Icon = { institutional: Sparkles, equipment: CookingPot, paslanmaz: ChefHat }[group] || ChefHat;
  return <div className="flex aspect-[4/3] w-full items-center justify-center bg-slate-50 p-4">
    {src && src !== failedSrc
      ? <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" onError={() => setFailedSrc(src)} />
      : <Icon aria-hidden="true" className="h-16 w-16" strokeWidth={1.25} style={{ color: CATEGORY_COLORS[group] }} />}
  </div>;
}
