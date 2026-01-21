// app/categories/page.jsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  ChevronRight,
  Loader2,
} from "lucide-react";

import { categoryData } from "../data/categoryData";
import { categoryMap } from "../data/categoryMap";
import { useLang } from "../context/LanguageContext";

import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "../../firebase";
import ProductCard from "../components/ProductCard";

const ITEMS_PER_PAGE = 18;

// Ana bileşeni iç içe fonksiyon olarak tanımla
function CategoriesContent() {
  const searchParams = useSearchParams();
  const groupFromUrl = searchParams.get("group");
  const { t } = useLang();

  const [selectedGroup, setSelectedGroup] = useState("institutional");

  // 🔁 ARTIK ANA KATEGORİLER SEÇİLİYOR
  const [selectedMainCategories, setSelectedMainCategories] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const db = useMemo(() => getFirestore(app), []);

  useEffect(() => {
    if (groupFromUrl && categoryData[groupFromUrl]) {
      setSelectedGroup(groupFromUrl);
      setSelectedMainCategories([]);
      setCurrentPage(1);
    }
  }, [groupFromUrl]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const snap = await getDocs(collection(db, "products"));
        setAllProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, [db]);

  const mainCategories =
    categoryData[selectedGroup]?.mainCategories || {};

  const mainCategoryKeys = useMemo(
    () => Object.keys(mainCategories),
    [mainCategories]
  );

  const toggleMainCategory = (mainKey) => {
    setCurrentPage(1);
    setSelectedMainCategories((prev) =>
      prev.includes(mainKey)
        ? prev.filter((x) => x !== mainKey)
        : [...prev, mainKey]
    );
  };

  /* =====================================================
     ÜRÜN FİLTRELEME (ANA KATEGORİYE GÖRE)
     ===================================================== */
  const filteredProducts = useMemo(() => {
    return allProducts
      .filter((p) => {
        const slug = Object.keys(categoryMap).find(
          (k) =>
            categoryMap[k].main === p.main_category &&
            categoryMap[k].sub === p.sub_category
        );
        if (!slug) return false;

        const belongsToGroup = Object.values(
          categoryData[selectedGroup].mainCategories
        ).some((list) => list.includes(slug));
        if (!belongsToGroup) return false;

        if (selectedMainCategories.length === 0) return true;

        return selectedMainCategories.some((mainKey) =>
          mainCategories[mainKey]?.includes(slug)
        );
      })
      // 🔴 İŞTE ASIL OLAY BURASI
      .sort((a, b) => a.order - b.order);
  }, [allProducts, selectedGroup, selectedMainCategories, mainCategories]);

  const totalPages = Math.ceil(
    filteredProducts.length / ITEMS_PER_PAGE
  );

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <nav className="flex items-center gap-2 text-sm mb-3">
            <Link href="/" className="text-gray-500">
              {t("categories.breadcrumb.home")}
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-300" />
            <span className="font-medium">
              {t(`category.group.${selectedGroup}`)}
            </span>
          </nav>

          <h1 className="text-3xl font-bold">
            {t(`category.group.${selectedGroup}`)}
          </h1>

          <p className="text-gray-600 mt-1">
            {filteredProducts.length} {t("common.product")}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* SOL FİLTRE */}
        <aside className="w-72 bg-white border rounded-xl p-6
          sticky top-24 h-[calc(100vh-140px)] overflow-y-auto">

          {/* ÜRÜN GRUPLARI */}
          <div className="mb-6">
            <h4 className="font-semibold mb-3">
              {t("filters.product_groups")}
            </h4>
            {Object.keys(categoryData).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setSelectedGroup(g);
                  setSelectedMainCategories([]);
                  setCurrentPage(1);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg mb-1
                  ${selectedGroup === g
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "hover:bg-gray-50"}`}
              >
                {t(`category.group.${g}`)}
              </button>
            ))}
          </div>

          {/* ANA KATEGORİLER */}
          <div>
            <h4 className="font-semibold mb-3">
              {t("filters.categories")}
            </h4>
            {mainCategoryKeys.map((mainKey) => (
              <label key={mainKey} className="flex gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  checked={selectedMainCategories.includes(mainKey)}
                  onChange={() => toggleMainCategory(mainKey)}
                />
                {t(`category.main.${mainKey}`)}
              </label>
            ))}
          </div>
        </aside>

        {/* SAĞ ÜRÜNLER */}
        <section className="flex-1">
          {productsLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin mx-auto mb-4" />
              Yükleniyor...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {paginatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded
                          ${page === currentPage
                            ? "bg-blue-600 text-white"
                            : "bg-white border hover:bg-gray-50"}`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

// Ana export - Suspense ile sarmala
export default function CategoriesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <CategoriesContent />
    </Suspense>
  );
}