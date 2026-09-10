"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Info, Mail, Menu, Phone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import UserMenu from "./UserMenu";
import { useLang } from "../context/LanguageContext";
import { languageOptions } from "../lib/language";

function LanguageFlag({ option }) {
  return (
    <span className="relative h-[18px] w-[18px] shrink-0 overflow-hidden rounded-full border border-white/70 shadow-sm ring-1 ring-slate-900/10">
      <Image src={option.flag} alt="" fill sizes="18px" className="object-cover" />
    </span>
  );
}

export default function Header() {
  const { t, lang, setLang } = useLang();
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { href: "/catalog", label: t("header.menu.products") },
      { href: "/contact", label: t("header.menu.contact") },
    ],
    [t]
  );
  const mobileNavItems = useMemo(
    () => [...navItems, { href: "/about", label: t("header.menu.about"), icon: Info }],
    [navItems, t]
  );

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  const closeMobileMenu = () => setMobileOpen(false);
  const activeLanguage = languageOptions.find((item) => item.code === lang) || languageOptions[0];
  const selectLanguage = (code) => {
    setLang(code);
    setLangOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[#f8fafc]">
        <div className="mx-auto flex min-h-10 max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-xs text-slate-600 sm:px-6 lg:px-8">
          <div className="hidden font-semibold text-[#1d3246] lg:block">Viroo Trade | HorecaLink</div>
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link href="/about" className="hidden items-center gap-2 transition hover:text-[#1d3246] lg:inline-flex"><Info size={14} />{t("header.menu.about")}</Link>
            <a href="tel:+77004446911" className="inline-flex items-center gap-1.5 transition hover:text-[#1d3246] sm:gap-2"><Phone size={14} /><span className="whitespace-nowrap">+7 700 444 69 11</span></a>
            <a href="mailto:info@horecalink.kz" className="hidden items-center gap-2 transition hover:text-[#1d3246] md:inline-flex"><Mail size={14} />info@horecalink.kz</a>
          </div>

          <div className="hidden items-center gap-1 sm:flex" aria-label={t("header.languageSelect")}>
            {languageOptions.map((item) => (
              <button key={item.code} type="button" onClick={() => selectLanguage(item.code)} title={item.label} aria-label={item.label} aria-pressed={lang === item.code}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-bold transition ${lang === item.code ? "bg-[#1d3246] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-[#1d3246]"}`}>
                <LanguageFlag option={item} /><span>{item.shortLabel}</span>
              </button>
            ))}
          </div>

          <div className="relative sm:hidden">
            <button type="button" onClick={() => setLangOpen((previous) => !previous)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 font-bold text-[#1d3246] shadow-sm ring-1 ring-slate-200" aria-label={t("header.languageSelect")} aria-expanded={langOpen}>
              <LanguageFlag option={activeLanguage} /><span>{activeLanguage.shortLabel}</span><ChevronDown size={13} aria-hidden="true" />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {languageOptions.map((item) => (
                  <button key={item.code} type="button" onClick={() => selectLanguage(item.code)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${lang === item.code ? "bg-[#1d3246] font-semibold text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                    <LanguageFlag option={item} /><span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-[84px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 max-w-[300px] items-center self-center py-3 lg:max-w-[360px] xl:max-w-[420px]">
          <Image src="/horecalink_logoapp.png" alt={t("header.alt.logo")} width={2640} height={767} className="block h-12 w-full object-contain sm:h-14 lg:h-[60px]" priority />
        </Link>
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 pl-6 md:flex lg:gap-5 lg:pl-10">
          <nav className="flex items-center gap-1 text-sm font-semibold text-gray-700 lg:gap-2">
            {navItems.map((item) => <Link key={item.href} href={item.href} className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 transition hover:bg-slate-100 hover:text-[#1d3246] lg:px-3">{item.label}</Link>)}
          </nav>
          <UserMenu />
        </div>
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 md:hidden" onClick={() => setMobileOpen(true)} aria-label={t("header.menu.openMenu")}><Menu size={22} /></button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden">
          <div className="ml-auto flex h-full w-[86%] max-w-[360px] flex-col bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <Image src="/horecalink_logoapp.png" alt={t("header.alt.logo")} width={2640} height={767} className="h-11 w-auto object-contain" />
              <button type="button" onClick={closeMobileMenu} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700" aria-label={t("header.menu.closeMenu")}><X size={20} /></button>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <a href="tel:+77004446911" className="flex items-center gap-2"><Phone size={16} />+7 700 444 69 11</a>
              <a href="mailto:info@horecalink.kz" className="flex items-center gap-2"><Mail size={16} />info@horecalink.kz</a>
            </div>
            <nav className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 text-base font-semibold text-slate-700">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} onClick={closeMobileMenu} className="inline-flex items-center gap-2 rounded-xl px-3 py-3 transition hover:bg-slate-100">{Icon ? <Icon size={18} /> : null}{item.label}</Link>;
              })}
            </nav>
            <div className="mt-6 border-t border-slate-100 pt-5"><UserMenu mobile onNavigate={closeMobileMenu} /></div>
          </div>
        </div>
      )}
    </header>
  );
}
