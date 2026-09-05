/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const labels = {
  tr: ['Duyurular', 'Önceki görsel', 'Sonraki görsel', 'Durdur', 'Oynat'],
  en: ['Highlights', 'Previous slide', 'Next slide', 'Pause', 'Play'],
  ru: ['Объявления', 'Предыдущий слайд', 'Следующий слайд', 'Пауза', 'Воспроизвести'],
  kz: ['Хабарландырулар', 'Алдыңғы сурет', 'Келесі сурет', 'Тоқтату', 'Ойнату'],
};

export default function HomeBanner() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/home-banner', { signal: controller.signal, cache: 'no-store' })
      .then(response => { if (!response.ok) throw new Error('Banner unavailable'); return response.json(); })
      .then(setSettings).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!settings || settings.slides?.length < 2) return null;
  return <BannerCarousel settings={settings} />;
}

export function BannerCarousel({ settings }) {
  const { lang } = useLang();
  const text = labels[lang] || labels.tr;
  const { slides, interval, autoplay } = settings;
  const [position, setPosition] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const busy = useRef(false);
  const timer = useRef(null);
  const touch = useRef(null);
  const suppressClick = useRef(false);
  const count = slides.length;
  const active = (position - 1 + count) % count;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { setReduced(media.matches); setHidden(document.hidden); };
    sync();
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearTimeout(timer.current);
      media.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const move = useCallback((direction) => {
    if (busy.current) return;
    busy.current = true;
    setAnimate(true);
    setPosition(current => current + direction);
    timer.current = setTimeout(() => {
      setAnimate(false);
      setPosition(current => current === 0 ? count : current === count + 1 ? 1 : current);
      busy.current = false;
    }, reduced ? 0 : 620);
  }, [count, reduced]);

  useEffect(() => {
    if (!autoplay || paused || hover || focused || hidden || reduced) return;
    const timeout = setTimeout(() => move(1), interval * 1000);
    return () => clearTimeout(timeout);
  }, [autoplay, paused, hover, focused, hidden, reduced, interval, position, move]);

  const items = [slides[count - 1], ...slides, slides[0]];
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label={text[0]} aria-roledescription="carousel">
      <div className="relative overflow-hidden rounded-2xl bg-slate-100 shadow-sm" style={{ touchAction: 'pan-y' }}
        onPointerEnter={event => { if (event.pointerType === 'mouse') setHover(true); }} onPointerLeave={event => { if (event.pointerType === 'mouse') setHover(false); }}
        onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } }}
        onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; suppressClick.current = false; setHover(true); }}
        onTouchCancel={() => { touch.current = null; setHover(false); }}
        onTouchEnd={event => {
          if (touch.current) {
            const dx = event.changedTouches[0].clientX - touch.current.x;
            const dy = event.changedTouches[0].clientY - touch.current.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { suppressClick.current = true; move(dx < 0 ? 1 : -1); }
          }
          touch.current = null; setHover(false);
        }}
        onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
        <div className="flex aspect-[3/1]" style={{ transform: `translateX(-${position * 100}%)`, transition: animate && !reduced ? 'transform 600ms ease-in-out' : 'none' }}>
          {items.map((slide, index) => (
            <div key={`${slide.id}-${index}`} className="h-full w-full shrink-0" aria-hidden={index !== position} inert={index !== position ? true : undefined}>
              {slide.href ? <a href={slide.href} className="block h-full"><img src={slide.src} alt={slide.alt} draggable={false} className="h-full w-full object-contain" /></a>
                : <img src={slide.src} alt={slide.alt} draggable={false} className="h-full w-full object-contain" />}
            </div>
          ))}
        </div>
        <button type="button" aria-label={text[1]} onClick={() => move(-1)} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white"><ChevronLeft /></button>
        <button type="button" aria-label={text[2]} onClick={() => move(1)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white"><ChevronRight /></button>
      </div>
      <div className="mt-2 flex min-h-11 items-center justify-center gap-3 text-sm text-slate-600">
        <span aria-live={autoplay && !paused ? 'off' : 'polite'}>{active + 1} / {count}</span>
        {autoplay && !reduced && <button type="button" className="flex min-h-11 items-center gap-1 rounded px-3 hover:bg-slate-200" onClick={() => setPaused(value => !value)} aria-label={paused ? text[4] : text[3]}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? text[4] : text[3]}</button>}
      </div>
    </section>
  );
}
