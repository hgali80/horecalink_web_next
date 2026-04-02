// app/products/page.jsx
"use client";

import Link from "next/link";
import React, { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

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
    <main className="min-h-screen bg-gray-50 px-6 py-10 sm:px-10 md:px-24 lg:px-48 xl:px-64 2xl:px-[20rem]">
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

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{pageTitle}</h1>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{t("products.sort.label")}:</span>
          <select
            className="rounded-md border px-2 py-1 focus:outline-none focus:ring-indigo-400"
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

      <ProductList
        filterSubCategory={subCategory}
        filterMainCategory={main}
        filterGroup={group}
        searchQuery={q}
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
