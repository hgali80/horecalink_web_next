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
const TENGE_SYMBOL = "\u20B8";

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

function isStainlessProduct(product) {
  const groupKey = cleanText(product?.groupKey).toLowerCase();
  return ["paslanmaz", "stainless", "stainless-steel", "stainless_steel"].includes(
    groupKey
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
  const dimensions = isStainlessProduct(product)
    ? cleanText(product?.dimensions)
    : "";
  const imageUrl = getImageUrl(product);
  const displayImageUrl = !imageError && imageUrl ? imageUrl : PLACEHOLDER_IMAGE;
  const formattedPrice = formatPrice(product?.price);
  const unit = cleanText(product?.unit) || t("productDetail.unit");

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_16px_34px_rgba(29,50,70,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(29,50,70,0.1)] sm:rounded-[28px]">
      <Link href={href} className="relative block bg-[#f5f7f9]">
        <div className="relative aspect-[4/3.45] w-full overflow-hidden">
          <Image
            src={displayImageUrl}
            alt={title}
            fill
            unoptimized
            onError={() => setImageError(true)}
            className="object-contain p-3 transition-transform duration-500 group-hover:scale-105 sm:p-5"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-5">
        <div className="mb-2 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:mb-3 sm:text-[11px] sm:tracking-[0.16em]">
          {t("productDetail.stockCode")}: {code || "-"}
        </div>

        <h3 className="line-clamp-2 min-h-[44px] text-[14px] font-semibold leading-[1.15] tracking-[-0.03em] text-[#12263a] sm:min-h-[64px] sm:text-[18px] sm:tracking-[-0.04em]">
          <Link href={href}>{title}</Link>
        </h3>

        {dimensions ? (
          <p className="mt-1 truncate text-[10px] leading-4 text-slate-400 sm:text-[12px] sm:leading-5">
            {dimensions}
          </p>
        ) : null}

        {description ? (
          <p className="mt-2 line-clamp-2 min-h-[36px] text-[12px] leading-5 text-slate-500 sm:mt-3 sm:min-h-[48px] sm:text-[14px] sm:leading-6">
            {description}
          </p>
        ) : (
          <div className="mt-2 min-h-[36px] sm:mt-3 sm:min-h-[48px]" />
        )}

        <div className="mt-4 sm:mt-7">
          {formattedPrice ? (
            <div className="flex flex-wrap items-end gap-x-1 gap-y-0.5 text-[#12263a]">
              <span className="text-[17px] font-extrabold tracking-[-0.03em] sm:text-[22px] sm:tracking-[-0.04em]">
                {formattedPrice}
              </span>
              <span className="pb-[2px] text-[12px] font-bold sm:pb-[3px] sm:text-[14px]">
                {TENGE_SYMBOL}
              </span>
              <span className="pb-[2px] text-[11px] text-slate-500 sm:pb-[3px] sm:text-[13px]">
                / {unit}
              </span>
            </div>
          ) : (
            <div className="text-[12px] font-semibold text-slate-500 sm:text-[14px]">
              {t("productcard.noPrice")}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:mt-6 sm:gap-3 sm:pt-5">
          <Link
            href={href}
            className="inline-flex min-w-0 items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1d3246] transition hover:text-[#34495e] sm:gap-2 sm:text-[12px] sm:tracking-[0.14em]"
          >
            <span className="truncate">{t("productDetail.tabs.description")}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          </Link>

          <ProductQuoteActions product={product} variant="compact" />
        </div>
      </div>
    </article>
  );
}
