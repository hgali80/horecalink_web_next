'use client';

import Image from 'next/image';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '../context/LanguageContext';
import { CELEBRATIONS } from '../lib/celebrations';

const CelebrationContext = createContext(null);
const isInternal = path => path.startsWith('/satissitok') || path.startsWith('/admin') || path === '/login' || path === '/forgot-password';

export function CelebrationProvider({ children }) {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState(null);
  useEffect(() => {
    if (isInternal(pathname)) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch('/api/celebrations', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Kutlama yüklenemedi');
        const data = await response.json();
        setActiveId(data.activeId);
      } catch (error) { if (error.name !== 'AbortError') setActiveId(null); }
    };
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { controller.abort(); document.removeEventListener('visibilitychange', onVisible); };
  }, [pathname]);
  const celebration = isInternal(pathname) ? null : CELEBRATIONS.find(item => item.id === activeId);
  return <CelebrationContext.Provider value={celebration}>{children}</CelebrationContext.Provider>;
}

export function CelebrationStrip({ celebration, language }) {
  const copy = celebration.copy[language] || celebration.copy.ru;
  return <div className="border-b border-[#e9c75d] bg-[#007e94] text-white">
    <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2.5 text-center text-xs sm:text-sm">
      <Image src="/flags/kz.svg" width={26} height={26} alt="" className="shrink-0 rounded-full ring-1 ring-white/30" />
      <p><span className="font-medium text-[#fff0b0]">{copy.date}</span><span className="mx-2 text-[#f6d33c]" aria-hidden="true">·</span><span className="font-semibold">{copy.title}</span></p>
    </div>
  </div>;
}

export function CelebrationDetail({ celebration, language }) {
  const copy = celebration.copy[language] || celebration.copy.ru;
  return <aside className="flex items-center gap-4 rounded-2xl border border-[#d5bc67]/60 bg-gradient-to-br from-[#e8f7f8] to-[#fff9e8] p-4 sm:p-5">
    <Image src="/flags/kz.svg" width={64} height={64} alt="" className="h-14 w-14 shrink-0 rounded-full border-4 border-white shadow-sm sm:h-16 sm:w-16" />
    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-[#78601d]">{copy.date} · Kazakhstan</p><p className="mt-1 text-base font-bold leading-snug text-[#00566a] sm:text-lg">{copy.title}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{copy.note}</p></div>
  </aside>;
}

export function CelebrationBanner() {
  const celebration = useContext(CelebrationContext);
  const { lang } = useLang();
  return celebration ? <CelebrationStrip celebration={celebration} language={lang} /> : null;
}

export function CelebrationHeroDetail() {
  const celebration = useContext(CelebrationContext);
  const { lang } = useLang();
  return celebration ? <div className="mb-4"><CelebrationDetail celebration={celebration} language={lang} /></div> : null;
}
