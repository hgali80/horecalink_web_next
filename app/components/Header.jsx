// app/components/Header.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Globe } from "lucide-react";
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
    <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
      <div className="flex justify-between items-center px-6 py-2">
        {/* LOGO */}
        <Link href="/">
          <Image
            src="/horecalink_logoapp.png"
            alt={t("header.alt.logo")}
            width={140}
            height={55}
            className="object-contain"
            priority
          />
        </Link>

        {/* DESKTOP */}
        <div className="hidden md:flex items-center space-x-8">
          <nav className="flex items-center space-x-6 text-gray-700 font-medium text-sm">
            <Link href="/about" className="hover:text-blue-600">
              {t("header.menu.about")}
            </Link>
            <Link href="/categories" className="hover:text-blue-600">
              {t("header.menu.products")}
            </Link>
            <Link href="/contact" className="hover:text-blue-600">
              {t("header.menu.contact")}
            </Link>
          </nav>

          {/* SEARCH */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = e.currentTarget.search.value;
              if (val.trim()) {
                alert(t("header.search.alert", { value: val }));
              }
            }}
            className="flex items-center bg-gray-100 rounded-full px-3 py-1.5"
          >
            <input
              type="text"
              name="search"
              placeholder={t("header.search.placeholder")}
              className="bg-transparent outline-none text-sm px-2 w-36 md:w-48"
            />
            <button className="text-gray-500">🔍</button>
          </form>

          {/* LANGUAGE */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 text-sm font-medium"
            >
              <Globe size={18} />
              {t("header.language")}
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-md border w-36">
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
        >
          ☰
        </button>
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
              <Link href="/categories" onClick={() => setMobileOpen(false)}>
                {t("header.menu.products")}
              </Link>
              <Link href="/contact" onClick={() => setMobileOpen(false)}>
                {t("header.menu.contact")}
              </Link>
            </nav>

            <div className="mt-6 border-t pt-4">
              <p className="font-semibold mb-2">
                {t("header.languageSelect")}
              </p>
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
