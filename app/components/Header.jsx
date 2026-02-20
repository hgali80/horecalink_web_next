// app/components/Header.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Info, User, Flag } from "lucide-react";
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* LOGO */}
          <Link href="/" className="flex items-center">
            <Image
              src="/horecalink_logoapp.png"
              alt={t("header.alt.logo")}
              width={320}
              height={80}
              className="object-contain w-28 h-auto md:w-36"
              priority
            />
          </Link>

          {/* DESKTOP */}
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-6 text-sm font-semibold text-gray-700">
              <Link
                href="/about"
                className="hover:text-[#003366] transition-colors flex items-center gap-1"
              >
                <Info size={18} />
                {t("header.menu.about")}
              </Link>
              <Link
                href="/profile"
                className="hover:text-[#003366] transition-colors flex items-center gap-1"
              >
                <User size={18} />
                {t("header.menu.account") || t("header.menu.profile") || "Hesabım"}
              </Link>
            </nav>

            {/* LANGUAGE */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-xs font-bold uppercase text-gray-700 hover:bg-gray-200 transition"
                aria-label={t("header.languageSelect") || "Dil"}
              >
                <Flag size={16} />
                <span>{`DİL: ${lang?.toUpperCase?.() || "TR"}`}</span>
              </button>

              {langOpen && (
                <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-md border w-40 overflow-hidden">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLang(l.code);
                        setLangOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-100 text-sm ${
                        lang === l.code ? "font-semibold" : ""
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <UserMenu />
          </div>

          {/* MOBILE BUTTON */}
          <button
            className="md:hidden text-2xl"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 md:hidden">
          <div className="w-72 bg-white h-full shadow-xl p-6 relative">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-xl"
            >
              ✕
            </button>

            <nav className="flex flex-col gap-4 mt-10 text-base font-medium">
              <Link href="/about" onClick={() => setMobileOpen(false)}>
                {t("header.menu.about")}
              </Link>
              <Link href="/profile" onClick={() => setMobileOpen(false)}>
                {t("header.menu.account") || t("header.menu.profile") || "Hesabım"}
              </Link>
            </nav>

            <div className="mt-6 border-t pt-4">
              <p className="font-semibold mb-2">{t("header.languageSelect")}</p>
              <div className="flex flex-col gap-2">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code);
                      setMobileOpen(false);
                    }}
                    className={`text-left px-3 py-2 hover:bg-gray-100 text-sm ${
                      lang === l.code ? "font-semibold" : ""
                    }`}
                  >
                    {l.label}
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