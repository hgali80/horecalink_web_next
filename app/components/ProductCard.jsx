//app/components/ProductCard.jsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import ProductQuoteActions from "./ProductQuoteActions";

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";
const PLACEHOLDER_IMAGE = "/Placeholder.png";

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
}

function getProductHref(product) {
  const slug = cleanText(product?.slug);
  const id = cleanText(product?.id);
  return `/products/${slug || id}`;
}

function getProductName(product) {
  return (
    cleanText(product?.name) ||
    cleanText(product?.name_tr) ||
    cleanText(product?.name_ru) ||
    "Product"
  );
}

function getProductDescription(product) {
  return (
    cleanText(product?.shortDescription) ||
    cleanText(product?.shortDescription_ru) ||
    cleanText(product?.description) ||
    ""
  );
}

function getProductCode(product) {
  return (
    cleanText(product?.stock_code) ||
    cleanText(product?.sku) ||
    cleanText(product?.manufacturerCode) ||
    cleanText(product?.id)
  );
}

function ensureImageExtension(value) {
  const text = cleanText(value);
  if (!text) return "";
  return /\.[a-z0-9]+$/i.test(text) ? text : `${text}.jpg`;
}

function getImageUrl(product) {
  const imageNames = Array.isArray(product?.image_names)
    ? product.image_names.map((item) => ensureImageExtension(item)).filter(Boolean)
    : [];
  const fallbackImageName =
    ensureImageExtension(product?.imageBase) ||
    ensureImageExtension(product?.stock_code) ||
    ensureImageExtension(product?.sku) ||
    ensureImageExtension(product?.manufacturerCode) ||
    ensureImageExtension(product?.id);
  const imageName = imageNames[0] || fallbackImageName;
  if (!imageName) return null;

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(
    imageName
  )}?alt=media`;
}

export default function ProductCard({ product }) {
  const { t } = useLang();
  const [imageError, setImageError] = useState(false);

  const href = getProductHref(product);
  const title = getProductName(product);
  const description = getProductDescription(product);
  const code = getProductCode(product);
  const imageUrl = getImageUrl(product);
  const displayImageUrl = !imageError && imageUrl ? imageUrl : PLACEHOLDER_IMAGE;
  const formattedPrice = formatPrice(product?.price);
  const unit = cleanText(product?.unit) || t("productDetail.unit");

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_16px_34px_rgba(29,50,70,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(29,50,70,0.1)]">
      <Link href={href} className="relative block bg-[#f5f7f9]">
        <div className="relative aspect-[4/3.45] w-full overflow-hidden">
          <Image
            src={displayImageUrl}
            alt={title}
            fill
            unoptimized
            onError={() => setImageError(true)}
            className="object-contain p-5 transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
          {t("productDetail.stockCode")}: {code || "-"}
        </div>

        <h3 className="line-clamp-2 min-h-[64px] text-[18px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#12263a]">
          <Link href={href}>{title}</Link>
        </h3>

        {description ? (
          <p className="mt-3 line-clamp-2 min-h-[48px] text-[14px] leading-6 text-slate-500">
            {description}
          </p>
        ) : (
          <div className="mt-3 min-h-[48px]" />
        )}

        <div className="mt-7">
          {formattedPrice ? (
            <div className="flex items-end gap-1 text-[#12263a]">
              <span className="text-[22px] font-extrabold tracking-[-0.04em]">{formattedPrice}</span>
              <span className="pb-[3px] text-[14px] font-bold">₸</span>
              <span className="pb-[3px] text-[13px] text-slate-500">/ {unit}</span>
            </div>
          ) : (
            <div className="text-[14px] font-semibold text-slate-500">
              {t("productcard.noPrice")}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <Link
            href={href}
            className="inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#1d3246] transition hover:text-[#34495e]"
          >
            {t("productDetail.tabs.description")}
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <ProductQuoteActions product={product} variant="compact" />
        </div>
      </div>
    </article>
  );
}
