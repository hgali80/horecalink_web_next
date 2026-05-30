"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Layers3 } from "lucide-react";

import { useLang } from "../context/LanguageContext";
import {
  getUsageAreaDescription,
  getUsageAreaName,
  listUsageAreas,
} from "../lib/usageAreas";

export default function UsageAreasPage() {
  const { lang, t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const list = await listUsageAreas({ activeOnly: true, includeInactive: false });
        if (alive) setItems(list);
      } catch (err) {
        console.error("Usage areas page yuklenemedi:", err);
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 pb-16 pt-10 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <nav className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Link href="/" className="transition hover:text-[#1d3246]">
            {t("breadcrumb.home")}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-[#1d3246]">{t("usageAreas.section.viewAll")}</span>
        </nav>

        <header className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#edf3f8] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1d3246]">
            <Layers3 className="h-4 w-4" />
            HorecaLink
          </div>
          <h1 className="text-[38px] font-extrabold tracking-[-0.05em] text-[#1d3246] md:text-[48px]">
            {t("usageAreas.section.title")}
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-500">
            {t("usageAreas.section.description")}
          </p>
        </header>

        {loading ? (
          <div className="py-16 text-center text-slate-500">{t("usageAreas.loading")}</div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-5 py-16 text-center text-slate-500">
            {t("usageAreas.empty")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const title = getUsageAreaName(item, lang);
              const description = getUsageAreaDescription(item, lang);
              const productCount = Array.isArray(item.productIds) ? item.productIds.length : 0;

              return (
                <Link
                  key={item.id}
                  href={`/usage-areas/${item.slug}`}
                  className="group overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="relative h-[250px] overflow-hidden bg-slate-200">
                    <Image
                      src={item.imagePreviewUrl}
                      alt={title}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#12263a]/85 via-[#12263a]/15 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <h2 className="text-2xl font-extrabold tracking-[-0.04em]">{title}</h2>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="line-clamp-3 text-sm leading-6 text-slate-500">{description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {productCount > 0
                          ? t("usageAreas.productCount", { count: productCount })
                          : t("usageAreas.noProducts")}
                      </span>
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1d3246]">
                        {t("usageAreas.cardCta")}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
