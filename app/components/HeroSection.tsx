// app/components/HeroSection.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useLang } from "../context/LanguageContext";

export default function HeroSection() {
  const { t } = useLang();
  const router = useRouter();

  const [q, setQ] = useState("");

  const placeholder = useMemo(() => {
    return (
      t("home.hero.search.placeholder") ||
      t("header.search.placeholder") ||
      "Ürün, marka veya kategori ara..."
    );
  }, [t]);

  const title =
    t("home.hero.search.title") ||
    t("home.hero.title") ||
    "Bugün hangi ürünü arıyorsunuz?";

  const subtitle =
    t("home.hero.search.subtitle") ||
    t("home.hero.subtitle") ||
    "HorecaLink B2B Profesyonel Çözüm Ortağınız";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = q.trim();
    if (!val) return;

    router.push(`/products?q=${encodeURIComponent(val)}`);
  };

  return (
    <section className="relative py-20 px-4 bg-[#F8F9FA] overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h1 className="text-slate-900 text-3xl md:text-5xl font-black mb-8 tracking-tight">
          {title}
        </h1>

        <form onSubmit={onSubmit} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <Search className="text-slate-400" />
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="block w-full pl-16 pr-32 py-5 bg-white border-none rounded-2xl shadow-xl focus:outline-none focus:ring-4 focus:ring-[#003366]/20 text-lg placeholder:text-slate-400 transition-all"
            placeholder={placeholder}
            type="text"
            inputMode="search"
            name="q"
          />

          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#003366] hover:bg-[#003366]/90 text-white px-8 py-3 rounded-xl font-bold transition-all"
          >
            {t("home.hero.search.button") || "Ara"}
          </button>
        </form>

        <p className="mt-6 text-slate-500 font-medium">{subtitle}</p>
      </div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-10 left-1/4 w-64 h-64 bg-[#003366] rounded-full blur-[120px]" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-blue-300 rounded-full blur-[150px]" />
      </div>
    </section>
  );
}