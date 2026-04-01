"use client";

import Link from "next/link";
import Image from "next/image";
import { Flag, Info, Mail, Menu, Phone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import UserMenu from "./UserMenu";
import { useLang } from "../context/LanguageContext";
import { languageOptions } from "../lib/language";

export default function Header() {
  const { t, lang, setLang } = useLang();
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { href: "/catalog", label: t("header.menu.products") },
      { href: "/teklifler", label: t("header.menu.quotes") },
      { href: "/contact", label: t("header.menu.contact") },
      { href: "/about", label: t("header.menu.about"), icon: Info },
    ],
    [t]
  );

  useEffect(() => {
    if (!mobileOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-[#f8fafc]">
        <div className="mx-auto hidden max-w-7xl items-center justify-between px-4 py-2 text-xs text-slate-600 md:flex sm:px-6 lg:px-8">
          <div className="font-semibold text-[#1d3246]">Viroo Trade | HorecaLink</div>
          <div className="flex items-center gap-5">
            <a href="tel:+77004446911" className="inline-flex items-center gap-2 transition hover:text-[#1d3246]">
              <Phone size={14} />
              +7 700 444 69 11
            </a>
            <a href="mailto:info@horecalink.kz" className="inline-flex items-center gap-2 transition hover:text-[#1d3246]">
              <Mail size={14} />
              info@horecalink.kz
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center py-2">
          <Image
            src="/horecalink_logoapp.png"
            alt={t("header.alt.logo")}
            width={420}
            height={105}
            className="h-12 w-auto object-contain sm:h-14 lg:h-16"
            priority
          />
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 md:flex lg:gap-5">
          <nav className="flex items-center gap-1 text-sm font-semibold text-gray-700 lg:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100 hover:text-[#1d3246]"
                >
                  {Icon ? <Icon size={16} /> : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold uppercase text-gray-700 transition hover:bg-gray-200"
              aria-label={t("header.languageSelect")}
            >
              <Flag size={16} />
              <span>{lang?.toUpperCase?.() || "TR"}</span>
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {languageOptions.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLang(item.code);
                      setLangOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 ${
                      lang === item.code ? "font-semibold text-[#1d3246]" : "text-slate-700"
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label={t("header.menu.openMenu")}
        >
          <Menu size={22} />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden">
          <div className="ml-auto flex h-full w-[86%] max-w-[360px] flex-col bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <Image
                src="/horecalink_logoapp.png"
                alt={t("header.alt.logo")}
                width={280}
                height={70}
                className="h-11 w-auto object-contain"
              />
              <button
                type="button"
                onClick={closeMobileMenu}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
                aria-label={t("header.menu.closeMenu")}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <a href="tel:+77004446911" className="inline-flex items-center gap-2">
                <Phone size={16} />
                +7 700 444 69 11
              </a>
              <a href="mailto:info@horecalink.kz" className="inline-flex items-center gap-2">
                <Mail size={16} />
                info@horecalink.kz
              </a>
            </div>

            <nav className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 text-base font-semibold text-slate-700">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-3 transition hover:bg-slate-100"
                  >
                    {Icon ? <Icon size={18} /> : null}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                {t("header.languageSelect")}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {languageOptions.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLang(item.code);
                      closeMobileMenu();
                    }}
                    className={`rounded-xl px-3 py-3 text-left text-sm transition ${
                      lang === item.code
                        ? "bg-[#1d3246] text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <UserMenu mobile onNavigate={closeMobileMenu} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
