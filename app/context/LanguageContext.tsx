//app/context/LanguageContext.jsx

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

import tr from "../locales/tr.json";
import ru from "../locales/ru.json";
import kz from "../locales/kz.json";
import en from "../locales/en.json";

type Language = "tr" | "ru" | "kz" | "en";

type Dict = Record<string, any>;

const translations: Record<Language, Dict> = {
  tr,
  ru,
  kz,
  en,
};

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("tr");

  // 🔹 İlk yüklemede localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hl_lang") as Language | null;
      if (saved && translations[saved]) {
        setLangState(saved);
      }
    } catch {}
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem("hl_lang", l);
    } catch {}
  };

  const dict = translations[lang];

  const t = (key: string): string => {
    // flat
    if (dict[key]) return dict[key];

    // nested
    const nested = key
      .split(".")
      .reduce((acc: any, k) => (acc ? acc[k] : null), dict);

    return nested ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLang must be used inside LanguageProvider");
  }
  return ctx;
}
