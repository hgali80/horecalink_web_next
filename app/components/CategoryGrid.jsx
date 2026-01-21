// app/components/CategoryGrid.jsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { getT } from "../lib/i18n";

const SUPPORTED = ["tr", "ru", "kz", "en"];

export default function CategoryGrid({ selectedGroup, searchTerm = "" }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const [activeLang, setActiveLang] = useState("tr");

  // 🔹 Dil tespiti (standart)
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

  // 🔹 Firestore'dan ürünleri çek (AYNI)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
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

  if (loading) {
    return (
      <div className="text-center text-gray-500 mt-10">
        {t("categoryGrid.loading")}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="text-center text-gray-500 mt-10">
        {t("categoryGrid.noProducts")}
      </div>
    );
  }

  // 🔹 Arama (AYNI)
  const term = searchTerm.toLowerCase();
  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(term)
  );

  // 🔹 Grup filtresi (AYNI)
  const visibleProducts = selectedGroup
    ? filteredProducts.filter(
        (p) => p.group?.toLowerCase() === selectedGroup.toLowerCase()
      )
    : filteredProducts;

  // 🔹 Ana kategoriye göre grupla
  const groupedByMainCategory = visibleProducts.reduce((acc, product) => {
    const raw = product.main_category;

    const mainCategory = raw
      ? t(`categoryGrid.main.${raw}`, { default: raw })
      : t("categoryGrid.otherCategory");

    if (!acc[mainCategory]) acc[mainCategory] = [];
    acc[mainCategory].push(product);
    return acc;
  }, {});

  const mainCategories = Object.entries(groupedByMainCategory);

  // 🔹 Firebase Storage linki (AYNI)
  const getFirebaseImageUrl = (imageName) => {
    return `https://firebasestorage.googleapis.com/v0/b/horecakatolog-e2d10.appspot.com/o/product_images%2F${encodeURIComponent(
      imageName
    )}?alt=media`;
  };

  // 🔹 Görsel seçimi (AYNI)
  const getImagePath = (product) => {
    if (product.image_names?.length) {
      return getFirebaseImageUrl(product.image_names[0]);
    }

    if (product.sub_category) {
      const iconFile = product.sub_category
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[ğüşıöç]/g, (c) =>
          ({ ğ: "g", ü: "u", ş: "s", ı: "i", ö: "o", ç: "c" }[c])
        );
      return `/category_icons/${iconFile}.png`;
    }

    return null;
  };

  return (
    <div className="space-y-10">
      {mainCategories.map(([mainTitle, items], i) => (
        <div key={i}>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 border-b border-gray-200 pb-2">
            {mainTitle}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((product, index) => {
              const imageSrc = getImagePath(product);

              const productName = product.name || "";

              return (
                <Link
                  key={index}
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
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    ) : (
                      <div className="text-gray-400 text-xs">
                        {t("categoryGrid.noImage")}
                      </div>
                    )}
                  </div>

                  <div className="p-3 text-center">
                    <h3 className="text-sm font-medium text-slate-700 truncate">
                      {productName}
                    </h3>
                    {product.stock_code && (
                      <p className="text-xs text-gray-400 mt-1">
                        {product.stock_code}
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
