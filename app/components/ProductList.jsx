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
import {
  getGroupLabel,
  getMainCategoryLabel,
  getSubcategoryLabel,
  resolveProductCategoryKeys,
} from "../lib/catalog/catalogLabels";

export default function ProductList({
  filterSubCategory,
  filterMainCategory,
  filterGroup,
  searchQuery,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const db = getFirestore(app);
  const { t, lang } = useLang();

  const targetSubcategoryKeys = useMemo(() => {
    if (filterSubCategory) {
      return categoryMap[filterSubCategory] ? [filterSubCategory] : [];
    }

    if (filterGroup && filterMainCategory) {
      return categoryData?.[filterGroup]?.mainCategories?.[filterMainCategory] || [];
    }

    return [];
  }, [filterSubCategory, filterGroup, filterMainCategory]);

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
          if (!targetSubcategoryKeys.length) {
            console.warn("[ProductList] categoryMap eslesmedi:", filterSubCategory);
            setProducts([]);
            return;
          }

          nextProducts = list.filter((product) => {
            const resolved = resolveProductCategoryKeys(product);
            return resolved.subcategoryKey === filterSubCategory;
          });
        } else if (filterMainCategory) {
          if (!filterGroup) {
            console.warn("[ProductList] main filtre var ama group yok.");
            setProducts([]);
            return;
          }

          if (!targetSubcategoryKeys.length) {
            console.warn(
              "[ProductList] main kategori icin kategori eslesmesi bulunamadi:",
              filterGroup,
              filterMainCategory
            );
            setProducts([]);
            return;
          }

          nextProducts = list.filter((product) => {
            const resolved = resolveProductCategoryKeys(product);
            return (
              resolved.groupKey === filterGroup &&
              resolved.categoryKey === filterMainCategory &&
              targetSubcategoryKeys.includes(resolved.subcategoryKey)
            );
          });
        }

        setProducts(nextProducts.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999)));
      } catch (err) {
        console.error("[ProductList] Urunler yuklenirken hata:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [db, filterSubCategory, filterMainCategory, filterGroup, targetSubcategoryKeys]);

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
        Yukleniyor...
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

            <Link href="/catalog" className="text-gray-500 hover:text-gray-900">
              {t("breadcrumb.categories") || t("menu.products") || "Kategoriler"}
            </Link>

            {filterGroup && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900 font-medium">
                  {getGroupLabel({ t, lang, groupKey: filterGroup, fallback: filterGroup })}
                </span>
              </>
            )}

            {filterMainCategory && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900 font-medium">
                  {getMainCategoryLabel({
                    t,
                    lang,
                    categoryKey: filterMainCategory,
                    fallback: filterMainCategory,
                  })}
                </span>
              </>
            )}

            {filterSubCategory && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900 font-medium">
                  {getSubcategoryLabel({
                    t,
                    lang,
                    subcategoryKey: filterSubCategory,
                    fallback: filterSubCategory,
                  })}
                </span>
              </>
            )}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">
          {filterSubCategory
            ? getSubcategoryLabel({
                t,
                lang,
                subcategoryKey: filterSubCategory,
                fallback: filterSubCategory,
              })
            : filterMainCategory
              ? `${t("products.allPrefix") || "Tum"} ${getMainCategoryLabel({
                  t,
                  lang,
                  categoryKey: filterMainCategory,
                  fallback: filterMainCategory,
                })}`
              : t("products.allProducts")}
        </h1>

        {filtered.length === 0 ? (
          <div>Urun bulunamadi.</div>
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
