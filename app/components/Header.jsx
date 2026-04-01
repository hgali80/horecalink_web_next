// app/components/Header.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Info, Flag } from "lucide-react";
import { useState } from "react";
import UserMenu from "./UserMenu";
import { useLang } from "../context/LanguageContext";

const LANGS = [
  { code: "tr", label: "🇹🇷 Türkçe" },
  { code: "ru", label: "🇷🇺 Русский" },
  { code: "kz", label: "🇰🇿 Қазақша" },
  { code: "en", label: "🇬🇧 English" },
];

export default function Header() {
  const { t, lang, setLang } = useLang();
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center h-16">
          <Image
            src="/horecalink_logoapp.png"
            alt={t("header.alt.logo") || "Horecalink"}
            width={320}
            height={80}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm font-semibold text-gray-700">
            <Link
              href="/about"
              className="hover:text-[#003366] transition-colors flex items-center gap-1"
            >
              <Info size={18} />
              {t("header.menu.about") || "Hakkımızda"}
            </Link>
          </nav>

          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold uppercase text-gray-700 transition hover:bg-gray-200"
              aria-label={t("header.languageSelect") || "Dil"}
            >
              <Flag size={16} />
              <span>{`DİL: ${lang?.toUpperCase?.() || "TR"}`}</span>
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-2 w-40 overflow-hidden rounded-md border bg-white shadow-lg">
                {LANGS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLang(item.code);
                      setLangOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                      lang === item.code ? "font-semibold" : ""
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <UserMenu />
        </div>

        <button
          type="button"
          className="text-2xl md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
        >
          ☰
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden">
          <div className="relative h-full w-72 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 text-xl"
            >
              ✕
            </button>

            <nav className="mt-10 flex flex-col gap-4 text-base font-medium">
              <Link href="/about" onClick={() => setMobileOpen(false)}>
                {t("header.menu.about") || "Hakkımızda"}
              </Link>
            </nav>

            <div className="mt-6 border-t pt-4">
              <p className="mb-2 font-semibold">
                {t("header.languageSelect") || "Dil"}
              </p>

              <div className="flex flex-col gap-2">
                {LANGS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLang(item.code);
                      setMobileOpen(false);
                    }}
                    className={`px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                      lang === item.code ? "font-semibold" : ""
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t pt-4">
              <UserMenu mobile />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}