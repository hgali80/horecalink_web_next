"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers3, SquareStack } from "lucide-react";

import { useLang } from "../context/LanguageContext";
import {
  getUsageAreaDescription,
  getUsageAreaName,
  listUsageAreas,
} from "../lib/usageAreas";

export default function UsageAreasSection() {
  const { lang, t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const list = await listUsageAreas({
          activeOnly: true,
          homeOnly: true,
          limitCount: 4,
        });
        if (!alive) return;
        setItems(list);
      } catch (err) {
        console.error("Usage areas yuklenemedi:", err);
        if (alive) {
          setItems([]);
          setError(err?.message || "Kullanim alanlari yuklenemedi.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#edf3f8] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1d3246]">
            <Layers3 className="h-4 w-4" />
            HorecaLink
          </div>
          <h2 className="text-2xl font-bold text-[#003366] sm:text-3xl">
            {t("usageAreas.section.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            {t("usageAreas.section.description")}
          </p>
        </div>

        <Link
          href="/usage-areas"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#003366] hover:underline"
        >
          {t("usageAreas.section.viewAll")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">{t("usageAreas.loading")}</div>
      ) : error ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-800">
          <div className="font-semibold">{t("usageAreas.section.title")}</div>
          <div className="mt-2">
            Firestore izin veya veri erisim sorunu nedeniyle kullanim alanlari getirilemedi.
          </div>
          <div className="mt-1 text-amber-700/90">{error}</div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-slate-500">
          {t("usageAreas.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const title = getUsageAreaName(item, lang);
            const description = getUsageAreaDescription(item, lang);
            const productCount = Array.isArray(item.productIds) ? item.productIds.length : 0;

            return (
              <Link
                key={item.id}
                href={`/usage-areas/${item.slug}`}
                className="group relative aspect-[8/5] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-900 shadow-[0_18px_40px_rgba(29,50,70,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_55px_rgba(29,50,70,0.18)]"
              >
                <Image
                  src={item.imagePreviewUrl}
                  alt={title}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#071520]/90 via-[#10293d]/45 to-transparent" />

                <div className="relative flex h-full flex-col justify-end p-6 text-white">
                  {productCount > 0 ? (
                    <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                      <SquareStack className="h-3.5 w-3.5" />
                      {t("usageAreas.productCount", { count: productCount })}
                    </div>
                  ) : null}

                  <h3 className="text-2xl font-extrabold leading-tight tracking-[-0.04em]">
                    {title}
                  </h3>
                  {description ? (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-100/90">
                      {description}
                    </p>
                  ) : null}

                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#ffb55a]">
                    {t("usageAreas.cardCta")}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
