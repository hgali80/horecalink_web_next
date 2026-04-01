//app/components/ProductCard.jsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, FileText, Package2 } from "lucide-react";
import { useLang } from "../context/LanguageContext";

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

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
    cleanText(product?.name_ru) ||
    cleanText(product?.name_tr) ||
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
    cleanText(product?.manufacturerCode) ||
    cleanText(product?.sku) ||
    cleanText(product?.id)
  );
}

function getBrand(product) {
  return cleanText(product?.brand) || "HorecaLink";
}

function getImageUrl(product) {
  const imageName = Array.isArray(product?.image_names) ? product.image_names[0] : "";
  if (!imageName) return null;

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(
    imageName
  )}?alt=media`;
}

export default function ProductCard({ product }) {
  const { t } = useLang();

  const href = getProductHref(product);
  const title = getProductName(product);
  const description = getProductDescription(product);
  const code = getProductCode(product);
  const brand = getBrand(product);
  const imageUrl = getImageUrl(product);
  const formattedPrice = formatPrice(product?.price);
  const unit = cleanText(product?.unit) || t("productDetail.unit");

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_14px_30px_rgba(29,50,70,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(29,50,70,0.08)]">
      <Link href={href} className="relative block bg-[#f5f7f9]">
        <div className="absolute left-4 top-4 z-10">
          <span className="inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#1d3246] shadow-sm">
            {brand}
          </span>
        </div>

        <div className="relative aspect-[4/3.3] w-full overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              unoptimized
              className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Package2 className="h-10 w-10" strokeWidth={1.75} />
                <span className="text-sm font-medium">{t("productDetail.noImage")}</span>
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {t("productDetail.stockCode")}: {code || "-"}
        </div>

        <h3 className="line-clamp-2 min-h-[58px] text-[16px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#12263a]">
          <Link href={href}>{title}</Link>
        </h3>

        {description ? (
          <p className="mt-3 line-clamp-2 min-h-[44px] text-[13px] leading-5 text-slate-500">
            {description}
          </p>
        ) : (
          <div className="mt-3 min-h-[44px]" />
        )}

        <div className="mt-6">
          {formattedPrice ? (
            <div className="flex items-end gap-1 text-[#12263a]">
              <span className="text-[18px] font-extrabold tracking-[-0.03em]">{formattedPrice}</span>
              <span className="pb-[2px] text-[13px] font-bold">T</span>
              <span className="pb-[2px] text-[12px] text-slate-500">/ {unit}</span>
            </div>
          ) : (
            <div className="text-[14px] font-semibold text-slate-500">
              Price on request
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Link
            href={href}
            className="inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#1d3246] transition hover:text-[#34495e]"
          >
            {t("productDetail.tabs.description")}
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <Link
            href={`/teklif-talep?product=${encodeURIComponent(product?.id || "")}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#1d3246] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white transition hover:bg-[#243f58]"
          >
            <FileText className="h-4 w-4" />
            {t("header.menu.createQuote")}
          </Link>
        </div>
      </div>
    </article>
  );
}
