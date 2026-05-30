"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import ProductCard from "@/app/components/ProductCard";
import { useLang } from "@/app/context/LanguageContext";
import { getProductsByIds } from "@/app/lib/firestore/products";
import {
  getUsageAreaBySlug,
  getUsageAreaDescription,
  getUsageAreaName,
} from "@/app/lib/usageAreas";

export default function UsageAreaDetailPage() {
  const { slug } = useParams();
  const { lang, t } = useLang();
  const [usageArea, setUsageArea] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const area = await getUsageAreaBySlug(slug);

        if (!alive) return;
        if (!area || area.isActive !== true) {
          setNotFound(true);
          setUsageArea(null);
          setProducts([]);
          return;
        }

        const linkedProducts = await getProductsByIds(area.productIds || []);
        if (!alive) return;
        setUsageArea(area);
        setProducts(linkedProducts);
      } catch (err) {
        console.error("Usage area detail yuklenemedi:", err);
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-slate-500">
        {t("usageAreas.loading")}
      </div>
    );
  }

  if (notFound || !usageArea) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="text-lg font-semibold text-slate-900">{t("usageAreas.notFound")}</div>
          <Link href="/usage-areas" className="mt-4 inline-flex text-sm font-semibold text-[#1d3246] hover:underline">
            {t("usageAreas.section.viewAll")}
          </Link>
        </div>
      </div>
    );
  }

  const title = getUsageAreaName(usageArea, lang);
  const description = getUsageAreaDescription(usageArea, lang);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-indigo-600 hover:underline">
          {t("breadcrumb.home")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/usage-areas" className="hover:text-indigo-600 hover:underline">
          {t("usageAreas.section.viewAll")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-gray-700">{title}</span>
      </nav>

      <section className="mb-8 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="relative h-[260px] bg-slate-200 sm:h-[320px]">
          <Image
            src={usageArea.imagePreviewUrl}
            alt={title}
            fill
            unoptimized
            sizes="100vw"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#12263a]/88 via-[#12263a]/48 to-transparent" />
          <div className="absolute inset-0 flex items-end p-6 sm:p-8">
            <div className="max-w-2xl text-white">
              <div className="mb-3 inline-flex rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur">
                {products.length > 0
                  ? t("usageAreas.productCount", { count: products.length })
                  : t("usageAreas.noProducts")}
              </div>
              <h1 className="text-3xl font-extrabold tracking-[-0.05em] sm:text-5xl">{title}</h1>
              {description ? (
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/90 sm:text-base">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {products.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-5 py-16 text-center text-slate-500">
          {t("usageAreas.noProducts")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
