// app/components/Header.jsx
// app/components/Header.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useLang } from "../context/LanguageContext";

export default function Header() {
  const { t } = useLang();

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16 gap-4">
          {/* LOGO */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/horecalink_logoapp.png"
              alt={t("header.alt.logo")}
              width={140}
              height={55}
              className="object-contain w-24 h-auto md:w-32 lg:w-[140px]"
              priority
            />
          </Link>

          {/* DESKTOP NAV */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-gray-700">
            <Link href="/about" className="hover:text-[#003366]">
              {t("header.menu.about")}
            </Link>
            <Link href="/categories" className="hover:text-[#003366]">
              {t("header.menu.products")}
            </Link>
            <Link href="/contact" className="hover:text-[#003366]">
              {t("header.menu.contact")}
            </Link>
          </nav>

          {/* SEARCH */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = e.currentTarget.search.value;
              if (!val?.trim()) return;
              window.location.href = `/products?q=${encodeURIComponent(val.trim())}`;
            }}
            className="hidden md:flex items-center bg-gray-100 rounded-full px-3 py-2 w-full max-w-[360px]"
          >
            <input
              type="text"
              name="search"
              placeholder={t("header.search.placeholder")}
              className="bg-transparent outline-none text-sm px-2 w-full"
            />
            <button className="text-gray-500" aria-label="search">
              🔍
            </button>
          </form>

          {/* MOBILE BUTTON */}
          <button
            className="lg:hidden text-2xl px-3 py-2 rounded-lg hover:bg-gray-100"
            onClick={() => setMobileOpen(true)}
            aria-label="menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 lg:hidden">
          <div className="w-72 bg-white h-full shadow-xl p-6 relative">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-xl"
              aria-label="close"
            >
              ✕
            </button>

            {/* Mobile Search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = e.currentTarget.search.value;
                if (!val?.trim()) return;
                setMobileOpen(false);
                window.location.href = `/products?q=${encodeURIComponent(val.trim())}`;
              }}
              className="flex items-center bg-gray-100 rounded-xl px-3 py-2 mt-8"
            >
              <input
                type="text"
                name="search"
                placeholder={t("header.search.placeholder")}
                className="bg-transparent outline-none text-sm px-2 w-full"
              />
              <button className="text-gray-500" aria-label="search">
                🔍
              </button>
            </form>

            <nav className="flex flex-col gap-4 mt-6 text-base font-medium">
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

            {/* Not: Auth kontrolleri artık TopBar'da */}
          </div>
        </div>
      )}
    </header>
  );
}
