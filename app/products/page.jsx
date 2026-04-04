// app/products/page.jsx
"use client";

import Link from "next/link";
import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import ProductList from "../components/ProductList";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import {
  getMainCategoryLabel,
  getSubcategoryLabel,
} from "../lib/catalog/catalogLabels";

function ProductsContent() {
  const searchParams = useSearchParams();
  const { t, lang } = useLang();
  const { user } = useAuth();

  const subCategory = searchParams.get("sub");
  const group = searchParams.get("group");
  const main = searchParams.get("main");
  const q = searchParams.get("q") || "";
  const [searchValue, setSearchValue] = useState(q);

  const pageTitle = useMemo(() => {
    if (subCategory) {
      return getSubcategoryLabel({ t, lang, subcategoryKey: subCategory, fallback: subCategory });
    }

    if (main) {
      return `${t("products.allPrefix")} ${getMainCategoryLabel({
        t,
        lang,
        categoryKey: main,
        fallback: main,
      })}`;
    }

    return t("products.allProducts");
  }, [lang, main, subCategory, t]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:text-indigo-600 hover:underline">
          {t("breadcrumb.home")}
        </Link>
        {" / "}

        {subCategory ? (
          <>
            <Link href="/catalog" className="hover:text-indigo-600 hover:underline">
              {t("breadcrumb.categories")}
            </Link>
            {" / "}
            <span className="font-medium text-gray-700">
              {getSubcategoryLabel({ t, lang, subcategoryKey: subCategory, fallback: subCategory })}
            </span>
          </>
        ) : main ? (
          <span className="font-medium text-gray-700">
            {getMainCategoryLabel({ t, lang, categoryKey: main, fallback: main })}
          </span>
        ) : (
          <span className="font-medium text-gray-700">{t("products.allProducts")}</span>
        )}
      </nav>

      <div className="mb-8 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-[-0.04em] text-gray-800">{pageTitle}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("filters.searchPlaceholder")}
            </p>
          </div>

          <div className="grid gap-4 lg:min-w-[680px] lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-[#1d3246] focus:bg-white focus:ring-4 focus:ring-slate-200"
              />
            </label>

            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="whitespace-nowrap">{t("products.sort.label")}:</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-slate-200"
                defaultValue="default"
                onChange={(event) => {
                  const sortEvent = new CustomEvent("sortProducts", {
                    detail: event.target.value,
                  });
                  window.dispatchEvent(sortEvent);
                }}
              >
                <option value="default">{t("products.sort.default")}</option>
                <option value="price_asc">{t("products.sort.priceAsc")}</option>
                <option value="price_desc">{t("products.sort.priceDesc")}</option>
                <option value="name_asc">{t("products.sort.nameAsc")}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <ProductList
        filterSubCategory={subCategory}
        filterMainCategory={main}
        filterGroup={group}
        searchQuery={searchValue}
        currentUserId={user?.uid}
      />
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-gray-600">Yukleniyor...</p>
          </div>
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
