// app/components/CategoryGrid.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getT } from "../lib/i18n";
import { categoryMap } from "../data/categoryMap";

const SUPPORTED = ["tr", "ru", "kz", "en"];
const STORAGE_BUCKET = "horecakatolog-e2d10.appspot.com";

const GROUP_LABELS = {
  institutional: "Kurumsal",
  equipment: "Yatırım",
  stainless: "Paslanmaz",
  accessories: "Aksesuar",
};

export default function CategoryGrid({ selectedGroup, searchTerm = "" }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const [activeLang, setActiveLang] = useState("tr");

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) || [];
    const first = segments[0];

    if (SUPPORTED.includes(first)) {
      setActiveLang(first);
      return;
    }

    const saved = localStorage.getItem("hl_lang");
    if (saved && SUPPORTED.includes(saved)) {
      setActiveLang(saved);
    }
  }, [pathname]);

  const t = getT(activeLang);
  const prefix = SUPPORTED.includes(activeLang) ? `/${activeLang}` : "";

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(
          collection(db, "products"),
          where("active", "==", true),
          where("webPublished", "==", true)
        );

        const querySnapshot = await getDocs(q);
        const productList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productList);
      } catch (error) {
        console.error("Ürünler yüklenirken hata:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const visibleProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return products
      .filter((p) => {
        if (selectedGroup && p.groupKey !== selectedGroup) return false;

        if (!term) return true;

        const haystack = [
          p.name,
          p.name_tr,
          p.manufacturerCode,
          p.brand,
          p.description,
          p.shortDescription,
          p.tags,
          p.subcategoryKey,
          p.categoryKey,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      })
      .sort((a, b) => {
        const ao = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 999999;
        const bo = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999999;
        return ao - bo;
      });
  }, [products, selectedGroup, searchTerm]);

  const groupedByCategory = useMemo(() => {
    return visibleProducts.reduce((acc, product) => {
      const meta = categoryMap[product.subcategoryKey];
      const categoryKey = product.categoryKey || "other";
      const categoryTitle =
        meta?.categoryLabel ||
        t(`category.main.${categoryKey}`) ||
        categoryKey;

      if (!acc[categoryTitle]) acc[categoryTitle] = [];
      acc[categoryTitle].push(product);
      return acc;
    }, {});
  }, [visibleProducts, t]);

  const categoryGroups = Object.entries(groupedByCategory);

  const getFirebaseImageUrl = (imageName) => {
    return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(
      imageName
    )}?alt=media`;
  };

  const getImagePath = (product) => {
    if (product.imageBase) {
      return getFirebaseImageUrl(product.imageBase);
    }

    const subKey = product.subcategoryKey;
    if (subKey) {
      return `/category_icons/${subKey}.png`;
    }

    return null;
  };

  if (loading) {
    return (
      <div className="text-center text-gray-500 mt-10">
        {t("categoryGrid.loading") || "Yükleniyor..."}
      </div>
    );
  }

  if (!visibleProducts.length) {
    return (
      <div className="text-center text-gray-500 mt-10">
        {t("categoryGrid.noProducts") || "Ürün bulunamadı"}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {selectedGroup && (
        <div className="text-sm text-gray-500">
          {t("categoryGrid.group") || "Grup"}:{" "}
          <span className="font-medium text-slate-700">
            {t(`category.group.${selectedGroup}`) || GROUP_LABELS[selectedGroup] || selectedGroup}
          </span>
        </div>
      )}

      {categoryGroups.map(([categoryTitle, items]) => (
        <div key={categoryTitle}>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 border-b border-gray-200 pb-2">
            {categoryTitle}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((product) => {
              const imageSrc = getImagePath(product);
              const productName = product.name || product.name_tr || "";

              return (
                <Link
                  key={product.id}
                  href={`${prefix}/products/${product.id}`}
                  className="block bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden transition transform hover:-translate-y-1"
                >
                  <div className="relative w-full h-40 bg-gray-100 flex items-center justify-center">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={productName}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="text-gray-400 text-xs">
                        {t("categoryGrid.noImage") || "Görsel yok"}
                      </div>
                    )}
                  </div>

                  <div className="p-3 text-center">
                    <h3 className="text-sm font-medium text-slate-700 truncate">
                      {productName}
                    </h3>

                    {product.manufacturerCode && (
                      <p className="text-xs text-gray-400 mt-1">
                        {product.manufacturerCode}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}