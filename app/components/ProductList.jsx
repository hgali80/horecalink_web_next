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

  const mainSubKeys = useMemo(() => {
    if (!filterGroup || !filterMainCategory) return [];
    const grp = categoryData?.[filterGroup];
    const arr = grp?.mainCategories?.[filterMainCategory];
    return Array.isArray(arr) ? arr : [];
  }, [filterGroup, filterMainCategory]);

  const firestoreSubValues = useMemo(() => {
    if (!mainSubKeys.length) return [];
    const values = mainSubKeys
      .map((subKey) => categoryMap?.[subKey]?.sub)
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [mainSubKeys]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);

      try {
        if (filterSubCategory) {
          if (!mapItem) {
            console.warn("[ProductList] categoryMap eşleşmedi:", filterSubCategory);
            setProducts([]);
            return;
          }

          const q = query(collection(db, "products"), where("sub_category", "==", mapItem.sub));
          const snap = await getDocs(q);
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setProducts(list);
          return;
        }

        if (filterMainCategory) {
          if (!filterGroup) {
            console.warn("[ProductList] main filtre var ama group yok.");
            setProducts([]);
            return;
          }

          if (!firestoreSubValues.length) {
            console.warn("[ProductList] main->sub listesi boş. group/main:", filterGroup, filterMainCategory);
            setProducts([]);
            return;
          }

          const chunks = [];
          for (let i = 0; i < firestoreSubValues.length; i += 30) {
            chunks.push(firestoreSubValues.slice(i, i + 30));
          }

          const all = [];
          for (const part of chunks) {
            const q = query(collection(db, "products"), where("sub_category", "in", part));
            const snap = await getDocs(q);
            snap.docs.forEach((d) => all.push({ id: d.id, ...d.data() }));
          }

          const uniq = Array.from(new Map(all.map((p) => [p.id, p])).values());
          setProducts(uniq);
          return;
        }

        const snap = await getDocs(collection(db, "products"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(list);
      } catch (err) {
        console.error("[ProductList] Ürünler yüklenirken hata:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [db, filterSubCategory, filterMainCategory, filterGroup, mapItem, firestoreSubValues]);

  // 🔎 Basit client-side arama (ad/marka/kod)
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