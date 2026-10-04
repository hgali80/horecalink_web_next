"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLang } from "../context/LanguageContext";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstalledNavigator = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<Array<{ id?: string }>>;
};
const dismissalKey = "hl_pwa_dismissed_day";
const installedKey = "hl_pwa_installed";
function today() {
  const date = new Date();
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}
function stored(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Private browsing may block storage. */ }
}

function browserHelp() {
  const ua = navigator.userAgent;
  return /SamsungBrowser/i.test(ua) ? "samsung" : /EdgA/i.test(ua) ? "edge" : /Chrome/i.test(ua) && !/; wv\)/i.test(ua) ? "chrome" : "other";
}

export default function PwaInstallBanner() {
  const { t } = useLang();
  const pathname = usePathname();
  const prompt = useRef<InstallEvent | null>(null);
  const installRequested = useRef(false);
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error) => console.warn("HorecaLink service worker registration failed", error));
    }
    const nav = navigator as InstalledNavigator;
    const display = window.matchMedia("(display-mode: standalone)");
    const isStandalone = () => display.matches || window.matchMedia("(display-mode: fullscreen)").matches || Boolean(nav.standalone);
    const android = /Android/i.test(navigator.userAgent);
    let cancelled = false;
    let installed = isStandalone() || stored(installedKey) === "1";
    let dismissed = stored(dismissalKey) === today();
    const canShow = () => android && !installed && !isStandalone() && !dismissed;
    const onPrompt = (event: Event) => {
      if (!android) return;
      event.preventDefault();
      prompt.current = event as InstallEvent;
    };
    const confirmInstalled = () => {
      installed = true;
      save(installedKey, "1");
      prompt.current = null;
      installRequested.current = false;
      setVisible(false);
    };
    const checkInstalled = async () => {
      if (isStandalone()) { confirmInstalled(); return; }
      if (!nav.getInstalledRelatedApps) return;
      try {
        const apps = await nav.getInstalledRelatedApps();
        if (!cancelled && apps.length) confirmInstalled();
      } catch {}
    };
    // Android fires appinstalled before the WebAPK has necessarily finished installing.
    const onInstalled = () => {
      prompt.current = null;
      installRequested.current = true;
      setHelp("pending");
      void checkInstalled();
    };
    const onDisplay = () => { if (isStandalone()) confirmInstalled(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === installedKey || event.key === dismissalKey) {
        installed = installed || stored(installedKey) === "1";
        dismissed = stored(dismissalKey) === today();
        if (!canShow()) setVisible(false);
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("storage", onStorage);
    display.addEventListener("change", onDisplay);
    if (isStandalone()) save(installedKey, "1");
    const timer = window.setTimeout(async () => {
      if (nav.getInstalledRelatedApps) {
        try {
          const apps = await nav.getInstalledRelatedApps();
          if (!cancelled) installed = isStandalone() || apps.length > 0;
        } catch {}
      }
      if (!cancelled && canShow()) setVisible(true);
    }, 15000);
    let checks = 0;
    const verificationTimer = window.setInterval(() => {
      if (installRequested.current && checks++ < 12) void checkInstalled();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(verificationTimer);
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("storage", onStorage);
      display.removeEventListener("change", onDisplay);
    };
  }, []);

  function dismiss() {
    installRequested.current = false;
    save(dismissalKey, today());
    setVisible(false);
    setHelp(null);
  }
  async function install() {
    const event = prompt.current;
    if (!event) {
      setHelp(browserHelp());
      return;
    }
    prompt.current = null;
    installRequested.current = true;
    setBusy(true);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "accepted") {
        setHelp("pending");
      } else {
        installRequested.current = false;
        save(dismissalKey, today());
        setHelp("retry");
      }
    } catch { installRequested.current = false; setHelp("error"); }
    finally { setBusy(false); }
  }

  // Keep business/admin and sign-in flows free of installation suggestions.
  if (!visible || /^\/(satissitok|login|register|payment|teklifler)(\/|$)/.test(pathname)) return null;
  return (
    <aside aria-label={t("pwa.title")} className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl" style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <button type="button" onClick={dismiss} aria-label={t("pwa.close")} className="absolute right-2 top-2 rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100">×</button>
      <div className="flex items-center gap-3 pr-9">
        <Image src="/android-chrome-192x192.png" width={48} height={48} alt="" className="rounded-xl" />
        <div><p className="text-sm font-semibold">{t("pwa.title")}</p><p className="mt-1 text-xs text-slate-600">{t("pwa.body")}</p></div>
      </div>
      {help && <p role="status" className="mt-3 text-sm">{t("pwa." + help)}</p>}
      {(help === "pending" || help === "retry") && <p className="mt-2 text-xs text-slate-600">{t("pwa." + browserHelp())}</p>}
      <button type="button" disabled={busy} onClick={install} className="mt-3 rounded-lg bg-[#0b3a53] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{t("pwa.install")}</button>
    </aside>
  );
}
