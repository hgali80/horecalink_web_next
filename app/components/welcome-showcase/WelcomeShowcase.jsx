'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Pause, Play, X } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { isCampaignActive, nextSlide, rememberShowcase, SLIDES, SLIDE_DURATION_MS } from './campaign.mjs';
import styles from './WelcomeShowcase.module.css';

const labels = {
  ru: { title: 'HorecaLink — от идеи до готового изделия', close: 'Закрыть', previous: 'Предыдущий слайд', next: 'Следующий слайд', pause: 'Приостановить', resume: 'Продолжить', enter: 'Перейти на сайт', loading: 'Загрузка…' },
  tr: { title: 'HorecaLink — fikirden hazır ürüne', close: 'Kapat', previous: 'Önceki slayt', next: 'Sonraki slayt', pause: 'Duraklat', resume: 'Devam et', enter: 'Siteye geç', loading: 'Yükleniyor…' },
  kz: { title: 'HorecaLink — идеядан дайын өнімге дейін', close: 'Жабу', previous: 'Алдыңғы слайд', next: 'Келесі слайд', pause: 'Кідірту', resume: 'Жалғастыру', enter: 'Сайтқа өту', loading: 'Жүктелуде…' },
  en: { title: 'HorecaLink — from idea to finished product', close: 'Close', previous: 'Previous slide', next: 'Next slide', pause: 'Pause', resume: 'Resume', enter: 'Continue to site', loading: 'Loading…' },
};

export default function WelcomeShowcase({ onDismiss }) {
  const { lang } = useLang();
  const ui = labels[lang] || labels.ru;
  const titleId = useId();
  const dialogRef = useRef(null);
  const progressRef = useRef(null);
  const remainingRef = useRef(SLIDE_DURATION_MS);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [loadedIndex, setLoadedIndex] = useState(-1);
  const [firstImageReady, setFirstImageReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const slide = SLIDES[index];
  const ready = loadedIndex === index;

  const dismiss = useCallback(() => {
    dialogRef.current?.close();
    onDismiss();
  }, [onDismiss]);

  const advance = useCallback((direction) => {
    if (!isCampaignActive()) { dismiss(); return; }
    const target = nextSlide(index, direction, SLIDES.length);
    if (target === null) { dismiss(); return; }
    remainingRef.current = SLIDE_DURATION_MS;
    if (progressRef.current) progressRef.current.style.transform = 'scaleX(0)';
    setIndex(target);
    setCycle(value => value + 1);
  }, [dismiss, index]);

  useEffect(() => {
    const onVisible = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!firstImageReady || !dialog || dialog.open) return;
    if (!isCampaignActive()) { onDismiss(); return; }
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    try { dialog.showModal(); } catch { onDismiss(); return; }
    rememberShowcase();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
    // Only acquire/release the modal once; slide loading must not close or reopen it.
  }, [firstImageReady, onDismiss]);

  useEffect(() => {
    if (!ready || hidden || paused) return;
    let frame;
    let previous = performance.now();
    const tick = now => {
      if (!isCampaignActive()) { dismiss(); return; }
      remainingRef.current = Math.max(0, remainingRef.current - (now - previous));
      previous = now;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${1 - remainingRef.current / SLIDE_DURATION_MS})`;
      if (remainingRef.current <= 0) { advance(1); return; }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [advance, cycle, dismiss, hidden, paused, ready]);

  useEffect(() => {
    if (!ready || !isCampaignActive()) return;
    const next = SLIDES[index + 1];
    if (!next) return;
    const image = new window.Image();
    image.src = next.image;
    return () => { image.src = ''; };
  }, [index, ready]);

  const photoHeight = slide.photo[1] - slide.photo[0];

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onKeyDown={event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); advance(event.key === 'ArrowRight' ? 1 : -1); }
      }}>
      <h2 id={titleId} className={styles.srOnly}>{ui.title}</h2>
      <button type="button" autoFocus className={styles.close} onClick={dismiss} aria-label={ui.close}><X size={24} /></button>
      <div className={styles.stage}>
        <div className={styles.mobileArtwork}>
          {/* Static campaign files are already optimized; share one URL across both layouts. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.image} alt={`${index + 1} / ${SLIDES.length}. ${slide.title}. ${slide.description}. ${slide.benefits.join('. ')}`}
            width="941" height="1671" loading="eager" decoding="async"
            onLoad={() => { setLoadedIndex(index); setFirstImageReady(true); }} onError={dismiss} />
        </div>
        <section className={styles.desktopArtwork} lang="ru" aria-hidden="true">
          <header className={styles.heading}>
            <div className={styles.logoCrop}>
              {/* CSS crops reuse the original artwork without redrawing the supplied logo or product. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SLIDES[0].image} alt="" width="941" height="1671" />
            </div>
            <h3>{index > 0 && <span className={styles.step}>{String(index).padStart(2, '0')} / </span>}{slide.title}</h3>
            <p>{slide.description}</p>
          </header>
          <div key={index} className={styles.photo} style={{ '--photo-ratio': 941 / (1671 * photoHeight) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.image} alt="" width="941" height="1671" style={{ top: `${-slide.photo[0] / photoHeight * 100}%` }} />
          </div>
          <ul className={styles.benefits}>{slide.benefits.map(text => <li key={text}><Check size={17} /><span>{text}</span></li>)}</ul>
        </section>
      </div>
      <footer className={styles.controls}>
        {!ready && <span className={styles.loading} role="status">{ui.loading}</span>}
        <div className={styles.progress} aria-label={`${index + 1} / ${SLIDES.length}`}>
          {SLIDES.map((item, position) => (
            <span key={item.image} className={styles.track} aria-current={position === index ? 'step' : undefined}>
              <span ref={position === index ? progressRef : null} className={styles.fill} style={{ transform: `scaleX(${position < index ? 1 : 0})` }} />
            </span>
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => advance(-1)} disabled={index === 0} aria-label={ui.previous}><ArrowLeft size={21} /></button>
          <span className={styles.count} aria-live="polite">{index + 1} / {SLIDES.length}</span>
          <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? ui.resume : ui.pause}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
          <button type="button" onClick={() => advance(1)} aria-label={ui.next}><ArrowRight size={21} /></button>
          <button type="button" className={styles.enter} onClick={dismiss}>{ui.enter}</button>
        </div>
      </footer>
    </dialog>
  );
}
