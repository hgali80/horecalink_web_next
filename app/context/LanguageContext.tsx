//app/context/LanguageContext.jsx

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => readStoredLanguage());

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }

    try {
      window.localStorage.setItem(languageStorageKey, lang);
    } catch {}
  }, [lang]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== languageStorageKey) return;

      if (event.newValue && isSupportedLanguage(event.newValue)) {
        setLangState(event.newValue as Language);
        return;
      }

      setLangState(defaultLanguage);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setLang = useCallback((nextLang: Language) => {
    if (!isSupportedLanguage(nextLang)) {
      return;
    }

    setLangState(nextLang);
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
