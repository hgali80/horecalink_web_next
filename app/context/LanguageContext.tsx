//app/context/LanguageContext.jsx

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  defaultLanguage,
  isSupportedLanguage,
  languageStorageKey,
  translate,
} from "../lib/language";

type Language = "tr" | "ru" | "kz" | "en";

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);
const listeners = new Set<() => void>();

function readStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }

  try {
    const saved = window.localStorage.getItem(languageStorageKey);
    if (saved && isSupportedLanguage(saved)) {
      return saved as Language;
    }
  } catch {}

  return defaultLanguage;
}

function notifyLanguageChange() {
  listeners.forEach((listener) => listener());
}

function subscribeToLanguage(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  listeners.add(callback);

  function handleStorage(event: StorageEvent) {
    if (event.key === languageStorageKey) {
      callback();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(
    subscribeToLanguage,
    readStoredLanguage,
    () => defaultLanguage
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((nextLang: Language) => {
    if (!isSupportedLanguage(nextLang)) {
      return;
    }

    try {
      window.localStorage.setItem(languageStorageKey, nextLang);
    } catch {}

    notifyLanguageChange();
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(lang, key, params),
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
    }),
    [lang, setLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLang must be used inside LanguageProvider");
  }
  return ctx;
}
