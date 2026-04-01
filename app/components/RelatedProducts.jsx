"use client";

import ProductCard from "./ProductCard";
import { useLang } from "../context/LanguageContext";

export default function RelatedProducts({ products = [] }) {
  const { t } = useLang();

  if (!products.length) return null;

  return (
    <section className="mt-24 border-t border-[#eceef0] pt-16">
      <h2 className="mb-12 text-2xl font-extrabold tracking-tight text-[#1d3246] md:text-3xl">
        {t("productDetail.related")}
      </h2>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {products.slice(0, 3).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
