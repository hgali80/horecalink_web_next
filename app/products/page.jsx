// app/products/page.jsx
"use client";

import { useSearchParams } from "next/navigation";
import React, { useEffect, useState, Suspense } from "react";
import ProductList from "../components/ProductList";

import { useAuth } from "../context/AuthContext";
import Link from "next/link";
import { useLang } from "../context/LanguageContext";

function ProductsContent() {
  const searchParams = useSearchParams();
  const { t } = useLang();

  const subCategory = searchParams.get("sub");
  const group = searchParams.get("group");
  const main = searchParams.get("main");
  const q = searchParams.get("q") || "";

  const { user } = useAuth();
  const [pageTitle, setPageTitle] = useState("");

  useEffect(() => {
    if (subCategory) {
      setPageTitle(t(`categories.sub.${subCategory}`));
      return;
    }

    if (main) {
      const prefix = t("products.allPrefix") || "Tüm";
      setPageTitle(`${prefix} ${t(`category.main.${main}`)}`);
      return;
    }

    setPageTitle(t("products.allProducts"));
  }, [subCategory, group, main, t]);

  return (
    <main className="min-h-screen bg-gray-50 px-6 sm:px-10 md:px-24 lg:px-48 xl:px-64 2xl:px-[20rem] py-10">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:underline hover:text-indigo-600">
          {t("breadcrumb.home")}
        </Link>
        {" / "}

        {subCategory ? (
          <>
            <Link href="/categories" className="hover:underline hover:text-indigo-600">
              {t("breadcrumb.categories")}
            </Link>
            {" / "}
            <span className="text-gray-700 font-medium">
              {t(`categories.sub.${subCategory}`)}
            </span>
          </>
        ) : main ? (
          <span className="text-gray-700 font-medium">
            {t(`category.main.${main}`)}
          </span>
        ) : (
          <span className="text-gray-700 font-medium">
            {t("products.allProducts")}
          </span>
        )}
      </nav>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">{pageTitle}</h1>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{t("products.sort.label")}:</span>
          <select
            className="border rounded-md px-2 py-1 focus:ring-indigo-400 focus:outline-none"
            defaultValue="default"
            onChange={(e) => {
              const sortEvent = new CustomEvent("sortProducts", {
                detail: e.target.value,
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}