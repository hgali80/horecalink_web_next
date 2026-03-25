// app/components/ProductList.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";

import { app } from "../../firebase";
import ProductCard from "./ProductCard";
import { categoryMap } from "../data/categoryMap";
import { categoryData } from "../data/categoryData";
import { useLang } from "../context/LanguageContext";

const CATEGORY_ALIASES = {
  "alunminyum konteyner": "aluminyum konteyner",
  "paketleme strec filmleri": "paketleme streç filmleri",
  "çatal bıçak kaşık": "çatal - bıçak - kaşık",
  "çatal – bıçak – kaşık": "çatal - bıçak - kaşık",
  "catal bicak kasik": "çatal - bıçak - kaşık",
};

function normalizeCategoryValue(value) {
  return String(value || "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function applyCategoryAlias(value) {
  return CATEGORY_ALIASES[value] || value;
}

function normalizeCategory(value) {
  return applyCategoryAlias(normalizeCategoryValue(value));
}

function matchesCategoryPair(product, expectedMain, expectedSub) {
  return (
    normalizeCategory(product?.main_category) === normalizeCategory(expectedMain) &&
    normalizeCategory(product?.sub_category) === normalizeCategory(expectedSub)
  );
}

export default function ProductList({
  filterSubCategory,
  filterMainCategory,
  filterGroup,
  searchQuery,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const db = getFirestore(app);
  const { t } = useLang();

  const mapItem = filterSubCategory ? categoryMap[filterSubCategory] : null;

  const targetCategoryPairs = useMemo(() => {
    if (filterSubCategory) {
      return mapItem ? [{ main: mapItem.main, sub: mapItem.sub }] : [];
    }

    if (filterGroup && filterMainCategory) {
      const grp = categoryData?.[filterGroup];
      const subKeys = grp?.mainCategories?.[filterMainCategory] || [];

      return subKeys
        .map((subKey) => categoryMap?.[subKey])
        .filter(Boolean)
        .map((item) => ({ main: item.main, sub: item.sub }));
    }

    return [];
  }, [filterSubCategory, mapItem, filterGroup, filterMainCategory]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);

      try {
        const q = query(
          collection(db, "products"),
          where("active", "==", true),
          where("webPublished", "==", true)
        );

        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        let nextProducts = list;

        if (filterSubCategory) {
          if (!mapItem) {
            console.warn("[ProductList] categoryMap eşleşmedi:", filterSubCategory);
            setProducts([]);
            return;
          }

          nextProducts = list.filter((product) =>
            matchesCategoryPair(product, mapItem.main, mapItem.sub)
          );
        } else if (filterMainCategory) {
          if (!filterGroup) {
            console.warn("[ProductList] main filtre var ama group yok.");
            setProducts([]);
            return;
          }

          if (!targetCategoryPairs.length) {
            console.warn(
              "[ProductList] main kategori için kategori eşleşmesi bulunamadı:",
              filterGroup,
              filterMainCategory
            );
            setProducts([]);
            return;
          }

          nextProducts = list.filter((product) =>
            targetCategoryPairs.some((pair) =>
              matchesCategoryPair(product, pair.main, pair.sub)
            )
          );
        }

        setProducts(nextProducts.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999)));
      } catch (err) {
        console.error("[ProductList] Ürünler yüklenirken hata:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [db, filterSubCategory, filterMainCategory, filterGroup, mapItem, targetCategoryPairs]);

  const filtered = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return products;

    return products.filter((p) => {
      const hay = [
        p.name_tr,
        p.name_ru,
        p.name_kz,
        p.name_en,
        p.name,
        p.brand,
        p.brandName,
        p.manufacturer,
        p.vendor,
        p.code,
        p.stock_code,
        p.sku,
        p.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [products, searchQuery]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        Yükleniyor…
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm">
            <Link href="/" className="text-gray-500 hover:text-gray-900">
              {t("categories.breadcrumb.home")}
            </Link>

            <span className="text-gray-300">/</span>

            <Link href="/categories" className="text-gray-500 hover:text-gray-900">
              {t("breadcrumb.categories") || t("menu.products") || "Kategoriler"}
            </Link>

            {filterGroup && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900 font-medium">
                  {t(`category.group.${filterGroup}`)}
                </span>
              </>
            )}

            {filterMainCategory && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900 font-medium">
                  {t(`category.main.${filterMainCategory}`)}
                </span>
              </>
            )}

            {filterSubCategory && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900 font-medium">
                  {t(`categories.sub.${filterSubCategory}`)}
                </span>
              </>
            )}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">
          {filterSubCategory
            ? t(`categories.sub.${filterSubCategory}`)
            : filterMainCategory
            ? `${t("products.allPrefix") || "Tüm"} ${t(`category.main.${filterMainCategory}`)}`
            : t("products.allProducts")}
        </h1>

        {filtered.length === 0 ? (
          <div>Ürün bulunamadı.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
