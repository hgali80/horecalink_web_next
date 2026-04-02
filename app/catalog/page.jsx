"use client";

import Link from "next/link";
import { BriefcaseBusiness, Building2, ChefHat, ChevronRight } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { getGroupLabel } from "../lib/catalog/catalogLabels";

const groups = [
  {
    key: "institutional",
    description: "catalog.groupCards.institutional",
    href: "/catalog/institutional",
    icon: Building2,
    fallback: "Temizlik & Hijyen",
  },
  {
    key: "equipment",
    description: "catalog.groupCards.equipment",
    href: "/catalog/equipment",
    icon: BriefcaseBusiness,
    fallback: "Mutfak Ekipmanlari",
  },
  {
    key: "stainless",
    description: "catalog.groupCards.stainless",
    href: "/catalog/stainless",
    icon: ChefHat,
    fallback: "Paslanmaz Ekipmanlar",
  },
];

export default function CatalogLandingPage() {
  const { t, lang } = useLang();

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 pb-16 pt-10 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <nav className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Link href="/" className="transition hover:text-[#1d3246]">
            {t("breadcrumb.home")}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-[#1d3246]">{t("breadcrumb.categories")}</span>
        </nav>

        <header className="mb-10">
          <h1 className="text-[38px] font-extrabold tracking-[-0.05em] text-[#1d3246] md:text-[48px]">
            {t("breadcrumb.categories")}
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-500">
            {t("catalog.groupIntro") || "Urun grubunu secerek kategori ve urunlere gecis yapin."}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {groups.map((group) => {
            const Icon = group.icon;
            const groupLabel = getGroupLabel({
              t,
              lang,
              groupKey: group.key,
              fallback: group.fallback,
            });

            return (
              <Link
                key={group.key}
                href={group.href}
                className="group rounded-[28px] border border-[#e5e7eb] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef1f4] text-[#1d3246] transition group-hover:bg-[#1d3246] group-hover:text-white">
                  <Icon className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-[#1d3246]">
                  {groupLabel}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">{t(group.description)}</p>
                <div className="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-[#1d3246]">
                  {t("catalog.openCatalog") || "Open catalog"}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}