/* eslint-disable @next/next/no-img-element */
'use client';
import { useState } from 'react';
import { Sparkles, CookingPot, ChefHat } from 'lucide-react';
import { CATEGORY_COLORS } from '@/app/lib/categoryImages';
export default function MainCategoryImage({ src, group, children }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const Icon = { institutional: Sparkles, equipment: CookingPot, paslanmaz: ChefHat }[group] || ChefHat;
  return <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-slate-50">
    {src && src !== failedSrc
      ? <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailedSrc(src)} />
      : <Icon aria-hidden="true" className="h-16 w-16" strokeWidth={1.25} style={{ color: CATEGORY_COLORS[group] }} />}
    {children && <div className="absolute inset-x-0 bottom-0 bg-white/90 px-3 py-3 text-center backdrop-blur-sm">{children}</div>}
  </div>;
}
