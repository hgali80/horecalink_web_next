'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { clearExpiredSession, ENDS_AT, hasSeenShowcase, isCampaignActive, STARTS_AT } from './campaign.mjs';

// Expired and returning sessions never download the slideshow component or its images.
const WelcomeShowcase = dynamic(() => import('./WelcomeShowcase'), { ssr: false });

export default function WelcomeShowcaseGate({ enabled, children }) {
  const [status, setStatus] = useState('checking');
  const [visible, setVisible] = useState(false);
  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!enabled) return;
    let timer;
    const update = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      const active = isCampaignActive(now);
      setStatus(active ? 'campaign' : 'seasonal');
      if (now >= ENDS_AT) clearExpiredSession();
      setVisible(current => active && (current || !hasSeenShowcase()));
      const boundary = now < STARTS_AT ? STARTS_AT : ENDS_AT;
      if (now < boundary) timer = window.setTimeout(update, Math.min(boundary - now, 2_147_483_647));
    };
    // Defer until after hydration; also recheck tabs restored from the back/forward cache.
    const initial = window.setTimeout(update, 0);
    const onVisible = () => { if (!document.hidden) update(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('focus', update);
    };
  }, [enabled]);

  if (!enabled) return children;
  if (status === 'checking') return null;
  if (status === 'seasonal') return children;
  // The campaign takes precedence over the seasonal opening, preventing stacked dialogs.
  return visible ? <WelcomeShowcase onDismiss={dismiss} /> : null;
}
