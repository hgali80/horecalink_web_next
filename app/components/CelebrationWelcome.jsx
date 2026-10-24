'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './CelebrationWelcome.module.css';

const seenThisVisit = new Set();
const labels = {
  kz: { enter: 'Сайтқа өту', hint: 'Жалғастыру үшін экранды түртіңіз', close: 'Жабу' },
  ru: { enter: 'Перейти на сайт', hint: 'Нажмите на экран, чтобы продолжить', close: 'Закрыть' },
  tr: { enter: 'Siteye devam et', hint: 'Devam etmek için ekrana dokunun', close: 'Kapat' },
  en: { enter: 'Continue to site', hint: 'Tap anywhere to continue', close: 'Close' },
};
const particles = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37 + 5) % 100}%`, top: `${(index * 23 + 7) % 100}%`,
  delay: `${-(index % 9)}s`, duration: `${7 + index % 6}s`,
  rotate: `${index * 29}deg`, size: `${4 + index % 5 * 2}px`,
}));

function GoldCorner() {
  return <svg viewBox="0 0 200 200" width="200" height="200" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 190V5h185M16 174V16h158" />
    {[0, 1, 2].map(index => <g key={index} transform={`translate(26 ${24 + index * 54})`}>
      <path d="M0 24C0 2 34 2 34 24c0 20-25 20-25 5 0-9 13-9 13 0M34 24c0-22 34-22 34 0 0 20-25 20-25 5 0-9 13-9 13 0M34 24v24m-12-9 12 9 12-9" />
    </g>)}
    {[0, 1].map(index => <g key={index} transform={`translate(${82 + index * 52} 24) rotate(90 22 22)`}>
      <path d="M0 24C0 2 34 2 34 24c0 20-25 20-25 5 0-9 13-9 13 0M34 24v24m-12-9 12 9 12-9" />
    </g>)}
  </svg>;
}

export default function CelebrationWelcome({ celebration, language, enabled = true, preview = false, onDismiss }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const activeId = celebration?.id;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!enabled || !activeId || !dialog) return;
    // An annual key lets next year's celebration appear in a long-lived tab too.
    const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Almaty' }).format(new Date());
    const key = `hl-celebration-welcome:${activeId}:${year}`;
    if (!preview) {
      if (seenThisVisit.has(key)) return;
      try { if (sessionStorage.getItem(key)) return; } catch {}
    }
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    if (!preview) {
      seenThisVisit.add(key);
      try { sessionStorage.setItem(key, 'seen'); } catch {}
    }
    const restoreScroll = () => { document.body.style.overflow = previousOverflow; };
    dialog.addEventListener('close', restoreScroll);
    return () => {
      dialog.removeEventListener('close', restoreScroll);
      if (dialog.open) dialog.close();
      restoreScroll();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [activeId, enabled, preview]);

  if (!celebration || !enabled) return null;
  const copy = celebration.copy[language] || celebration.copy.ru;
  const ui = labels[language] || labels.ru;
  const dismiss = () => { dialogRef.current?.close(); onDismiss?.(); };

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
    onClick={dismiss} onCancel={event => { event.preventDefault(); dismiss(); }}>
    <div className={styles.stage}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={`${styles.ornament} ${styles.topOrnament}`} aria-hidden="true"><GoldCorner /></div>
      <div className={`${styles.ornament} ${styles.bottomOrnament}`} aria-hidden="true"><GoldCorner /></div>
      <div className={styles.particles} aria-hidden="true">{particles.map((item, index) => <i key={index} className={index % 3 ? styles.confetti : styles.spark}
        style={{ left: item.left, top: item.top, '--delay': item.delay, '--duration': item.duration, '--rotation': item.rotate, '--size': item.size }} />)}</div>
      <button type="button" className={styles.close} aria-label={ui.close} onClick={event => { event.stopPropagation(); dismiss(); }}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
      <div className={styles.content}>
        {/* Decorative transparent WebP; all copy stays live and translated. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/celebrations/republic-day-emblem.webp" width="420" height="360" alt="" className={styles.emblem} />
        <p className={styles.date}><span />{copy.date}<span /></p>
        <h2 id={titleId} className={styles.title}>{copy.title}</h2>
        <p className={styles.note}>{copy.note}</p>
        <div className={styles.divider} aria-hidden="true"><span />◇<span /></div>
        <p className={styles.brand}>HORECA<span>LINK</span></p>
        <button type="button" autoFocus className={styles.enter} onClick={event => { event.stopPropagation(); dismiss(); }}>{ui.enter}<span aria-hidden="true">→</span></button>
        <p className={styles.hint}>{ui.hint}</p>
      </div>
      <div className={styles.ribbon} aria-hidden="true" />
    </div>
  </dialog>;
}
