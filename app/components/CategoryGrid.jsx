// app/components/CategoryGrid.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { categoryMap } from "../data/categoryMap";
import { useLang } from "../context/LanguageContext";

const GROUP_LABELS = {
  institutional: "Kurumsal",
  equipment: "Yatirim",
  stainless: "Paslanmaz",
  accessories: "Aksesuar",
};

export default function CategoryGrid({ selectedGroup, searchTerm = "" }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLang();

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
        console.error("Urunler yuklenirken hata:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const visibleProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return products
      .filter((product) => {
        if (selectedGroup && product.groupKey !== selectedGroup) return false;

        if (!term) return true;

        const haystack = [
          product.name,
          product.name_tr,
          product.manufacturerCode,
          product.brand,
          product.description,
          product.shortDescription,
          product.tags,
          product.subcategoryKey,
          product.categoryKey,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      })
      .sort((a, b) => {
        const aOrder = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 999999;
        const bOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999999;
        return aOrder - bOrder;
      });
  }, [products, searchTerm, selectedGroup]);

  const groupedByCategory = useMemo(() => {
    return visibleProducts.reduce((accumulator, product) => {
      const meta = categoryMap[product.subcategoryKey];
      const categoryKey = product.categoryKey || "other";
      const categoryTitle =
        t(`category.main.${categoryKey}`) || meta?.categoryLabel || categoryKey;

      if (!accumulator[categoryTitle]) {
        accumulator[categoryTitle] = [];
      }

      accumulator[categoryTitle].push(product);
      return accumulator;
    }, {});
  }, [t, visibleProducts]);

  const categoryGroups = Object.entries(groupedByCategory);

  const getFirebaseImageUrl = (imageName) =>
    `https://firebasestorage.googleapis.com/v0/b/horecakatolog-e2d10.appspot.com/o/product_images%2F${encodeURIComponent(
      imageName
    )}?alt=media`;

  const getImagePath = (product) => {
    if (product.imageBase) {
      return getFirebaseImageUrl(product.imageBase);
    }

    if (product.subcategoryKey) {
      return `/category_icons/${product.subcategoryKey}.png`;
    }

    return null;
  };

  if (loading) {
    return <div className="mt-10 text-center text-gray-500">{t("categoryGrid.loading")}</div>;
  }

  if (!visibleProducts.length) {
    return <div className="mt-10 text-center text-gray-500">{t("categoryGrid.noProducts")}</div>;
  }

  return (
    <div className="space-y-10">
      {selectedGroup ? (
        <div className="text-sm text-gray-500">
          {t("categoryGrid.group")}:{" "}
          <span className="font-medium text-slate-700">
            {t(`category.group.${selectedGroup}`) || GROUP_LABELS[selectedGroup] || selectedGroup}
          </span>
        </div>
      ) : null}

      {categoryGroups.map(([categoryTitle, items]) => (
        <div key={categoryTitle}>
          <h2 className="mb-4 border-b border-gray-200 pb-2 text-xl font-semibold text-slate-800">
            {categoryTitle}
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((product) => {
              const imageSrc = getImagePath(product);
              const productName = product.name || product.name_tr || "";

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug || product.id}`}
                  className="block overflow-hidden rounded-xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="relative flex h-40 w-full items-center justify-center bg-gray-100">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={productName}
                        fill
                        className="object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="text-xs text-gray-400">{t("categoryGrid.noImage")}</div>
                    )}
                  </div>

                  <div className="p-3 text-center">
                    <h3 className="truncate text-sm font-medium text-slate-700">{productName}</h3>

                    {product.manufacturerCode ? (
                      <p className="mt-1 text-xs text-gray-400">{product.manufacturerCode}</p>
                    ) : null}
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
