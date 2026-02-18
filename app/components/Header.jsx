// app/components/Header.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useLang } from "../context/LanguageContext";

export default function Header() {
  const { t } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);

  const goSearch = (e) => {
    e.preventDefault();
    const val = e.currentTarget.search.value;
    if (!val?.trim()) return;
    window.location.href = `/products?q=${encodeURIComponent(val.trim())}`;
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 gap-4">
          {/* LOGO (hedefteki gibi) */}
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-[#003366] p-2 rounded-lg">
              {/* Eğer logonun kendisi ikonsa bunu kullan, değilse aşağıdaki Image kalsın */}
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 48 48"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z"
                  fill="currentColor"
                />
              </svg>
            </div>

            <div className="leading-tight">
              <div className="text-2xl font-extrabold tracking-tight text-[#003366]">
                Horecalink<span className="text-amber-500">.kz</span>
              </div>
            </div>
          </Link>

          {/* DESKTOP MENU */}
          <div className="hidden lg:flex items-center space-x-8">
            <Link
              className="text-sm font-semibold hover:text-[#003366] transition-colors"
              href="/categories?group=institutional"
            >
              {t("header.menu.kurumsal") ?? "Kurumsal"}
            </Link>

            <Link
              className="text-sm font-semibold hover:text-[#003366] transition-colors"
              href="/categories?group=equipment"
            >
              {t("header.menu.ekipman") ?? "Ekipman"}
            </Link>

            <Link
              className="text-sm font-semibold hover:text-[#003366] transition-colors"
              href="/categories?group=stainless_steel"
            >
              {t("header.menu.paslanmaz") ?? "Paslanmaz"}
            </Link>

            <Link
              className="text-sm font-semibold hover:text-[#003366] transition-colors"
              href="/categories"
            >
              {t("header.menu.catalog") ?? "Katalog"}
            </Link>

            <Link
              className="text-sm font-semibold hover:text-[#003366] transition-colors"
              href="/about"
            >
              {t("header.menu.about") ?? "Hakkımızda"}
            </Link>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-4">
            {/* Search (hedefteki gibi sadece geniş ekranda) */}
            <form onSubmit={goSearch} className="relative hidden xl:block w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <span className="text-sm">🔍</span>
              </span>
              <input
                name="search"
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 text-sm"
                placeholder={t("header.search.placeholder") ?? "Ürün ara..."}
                type="text"
              />
            </form>

            {/* CTA button */}
            <Link
              href="/contact"
              className="bg-[#003366] text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-[#003366]/90 transition-all shadow-lg shadow-[#003366]/20"
            >
              {t("header.contactCta") ?? "Bize Ulaşın"}
            </Link>

            {/* MOBILE MENU BUTTON */}
            <button
              className="flex lg:hidden text-2xl px-2 py-2 rounded-lg hover:bg-slate-100"
              onClick={() => setMobileOpen(true)}
              aria-label="menu"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 lg:hidden">
          <div className="w-80 max-w-[85vw] bg-white h-full shadow-xl p-6 relative">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-xl"
              aria-label="close"
            >
              ✕
            </button>

            {/* Mobile search */}
            <form
              onSubmit={(e) => {
                goSearch(e);
                setMobileOpen(false);
              }}
              className="flex items-center bg-slate-100 rounded-xl px-3 py-2 mt-10"
            >
              <input
                type="text"
                name="search"
                placeholder={t("header.search.placeholder") ?? "Ürün ara..."}
                className="bg-transparent outline-none text-sm px-2 w-full"
              />
              <button className="text-slate-500" aria-label="search">
                🔍
              </button>
            </form>

            <nav className="flex flex-col gap-4 mt-6 text-base font-semibold text-slate-800">
              <Link href="/categories?group=institutional" onClick={() => setMobileOpen(false)}>
                {t("header.menu.kurumsal") ?? "Kurumsal"}
              </Link>
              <Link href="/categories?group=equipment" onClick={() => setMobileOpen(false)}>
                {t("header.menu.ekipman") ?? "Ekipman"}
              </Link>
              <Link href="/categories?group=stainless_steel" onClick={() => setMobileOpen(false)}>
                {t("header.menu.paslanmaz") ?? "Paslanmaz"}
              </Link>
              <Link href="/categories" onClick={() => setMobileOpen(false)}>
                {t("header.menu.catalog") ?? "Katalog"}
              </Link>
              <Link href="/about" onClick={() => setMobileOpen(false)}>
                {t("header.menu.about") ?? "Hakkımızda"}
              </Link>
              <Link href="/contact" onClick={() => setMobileOpen(false)}>
                {t("header.menu.contact") ?? "İletişim"}
              </Link>
            </nav>

            {/* Auth yok: TopBar’da */}
          </div>
        </div>
      )}
    </nav>
  );
}
