"use client";

import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  FileText,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";

import ProductGallery from "../../components/ProductGallery";
import RelatedProducts from "../../components/RelatedProducts";
import { useLang } from "../../context/LanguageContext";

const LEGACY_BADGE_ALIASES = {
  Yeni: "new",
  "Cok Satan": "best_seller",
  Kampanya: "campaign",
  Firsat: "opportunity",
  Onerilen: "recommended",
  Stokta: "in_stock",
  "Sinirli Stok": "limited_stock",
  "Proje Urunu": "project_product",
  "Profesyonel Seri": "professional_series",
};

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

function resolveText(t, key, fallback, params) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

function getProductCode(product) {
  return (
    cleanText(product?.stock_code) ||
    cleanText(product?.sku) ||
    cleanText(product?.manufacturerCode) ||
    cleanText(product?.id)
  );
}

function getBadge(product) {
  return cleanText(product?.badge);
}

function resolveBadgeLabel(t, badge) {
  const value = cleanText(badge);
  if (!value) return "";

  const badgeKey = LEGACY_BADGE_ALIASES[value] || value;
  const translated = t(`product.badges.${badgeKey}`);
  return translated === `product.badges.${badgeKey}` ? value : translated;
}

function getTechnicalSpecsText(product) {
  return cleanText(product?.specs);
}

function buildSpecs(product, t) {
  const labels = [
    ["productDetail.specs.code", "Kod", getProductCode(product)],
    ["productDetail.specs.brand", "Brand", cleanText(product?.brand)],
    ["productDetail.specs.unit", "Birim", cleanText(product?.unit)],
    ["productDetail.specs.material", "Materyal", cleanText(product?.material)],
    ["productDetail.specs.dimensions", "Olculer", cleanText(product?.dimensions)],
    ["productDetail.specs.capacity", "Hacim", cleanText(product?.capacity)],
    ["productDetail.specs.power", "Guc", cleanText(product?.power)],
    ["productDetail.specs.voltage", "Voltaj", cleanText(product?.voltage)],
    ["productDetail.specs.fuelType", "Yakit tipi", cleanText(product?.fuelType)],
    ["productDetail.specs.warranty", "Garanti", cleanText(product?.warranty)],
  ];

  return labels
    .filter(([, , value]) => value)
    .map(([key, fallback, value]) => [resolveText(t, key, fallback), value]);
}

function getDefaultHighlightLines(t) {
  return [
    resolveText(
      t,
      "productDetail.highlight.professionalText",
      "Bu urun HoReCa operasyonlarinda yogun kullanim icin uygundur."
    ),
    resolveText(
      t,
      "productDetail.highlight.updatedText",
      "Kart bilgileri Firestore katalog verisinden otomatik olusturulur."
    ),
    resolveText(
      t,
      "productDetail.highlight.fastQuoteText",
      "Ticari teklif talebinizi tek tikla iletebilirsiniz."
    ),
  ];
}

function buildHighlights(product, t) {
  const icons = [ShieldCheck, Sparkles, Truck];
  const customLines = cleanText(product?.highlightLines)
    .replace(/\s{2,}/g, "\n")
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean)
    .slice(0, 3);

  const lines = customLines.length ? customLines : getDefaultHighlightLines(t);

  return icons.map((icon, index) => ({
    icon,
    text: lines[index] || getDefaultHighlightLines(t)[index],
  }));
}

export default function ProductDetailClient({ product, relatedProducts }) {
  const { t } = useLang();
  const productTitle =
    cleanText(product?.name) ||
    cleanText(product?.name_tr) ||
    resolveText(t, "productDetail.notFound", "Urun");
  const productShortDescription =
    cleanText(product?.shortDescription) ||
    cleanText(product?.description) ||
    resolveText(t, "productDetail.noDescription", "Aciklama yok.");

  const specs = buildSpecs(product, t);
  const highlights = buildHighlights(product, t);
  const badge = resolveBadgeLabel(t, getBadge(product));
  const technicalSpecsText = getTechnicalSpecsText(product);
  const formattedPrice = formatPrice(product?.price);

  const groupKey = cleanText(product?.groupKey);
  const categoryKey = cleanText(product?.categoryKey);
  const subcategoryKey = cleanText(product?.subcategoryKey);

  const categoryHref =
    groupKey && categoryKey && subcategoryKey
      ? `/catalog/${groupKey}/${categoryKey}/${subcategoryKey}`
      : "/catalog";

  const code = getProductCode(product);

  return (
    <section className="bg-[#f8f9fb] pb-20 pt-24 text-[#191c1e]">
      <div className="mx-auto max-w-[1440px] px-6">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link href="/" className="transition-colors hover:text-[#1d3246]">
            {t("breadcrumb.home")}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/products" className="transition-colors hover:text-[#1d3246]">
            {t("header.menu.products")}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={categoryHref} className="transition-colors hover:text-[#1d3246]">
            {t("breadcrumb.categories")}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-bold text-[#1d3246]">
            {productTitle}
          </span>
        </nav>

        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ProductGallery product={product} />
          </div>

          <div className="flex flex-col gap-8 lg:col-span-5">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#34495e]">
                  {product.brand || "HorecaLink"}
                </span>

                {badge ? (
                  <span className="rounded-sm bg-[#1d3246] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                    {badge}
                  </span>
                ) : null}

                {product.isNew ? (
                  <span className="rounded-sm border border-[#c3c7cd] bg-[#eceef0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1d3246]">
                    New
                  </span>
                ) : null}
              </div>

              <h1 className="mb-2 text-2xl font-semibold leading-[1.2] tracking-[-0.02em] text-[#1d3246] md:text-3xl lg:text-4xl">
                {productTitle}
              </h1>

              <p className="mb-6 text-sm font-semibold text-slate-500">
                {t("productDetail.stockCode")}: {code || "-"}
              </p>

              <p className="mb-8 text-lg leading-relaxed text-slate-600">
                {productShortDescription}
              </p>

              <div className="mb-10 space-y-4">
                {highlights.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-[#34495e]" />
                      <span className="font-medium">{item.text}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-4">
                <div className="mb-4 flex items-baseline gap-2">
                  {formattedPrice ? (
                    <>
                      <span className="text-3xl font-extrabold italic tracking-tight text-[#1d3246]">
                        {formattedPrice} ₸
                      </span>
                      <span className="text-lg font-semibold text-slate-500">
                        / {product.unit || resolveText(t, "productDetail.unit", "adet")}
                      </span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-slate-500">Price on request</span>
                  )}
                </div>

                <Link
                  href={`/teklif-talep?product=${encodeURIComponent(product.id || "")}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#1d3246] to-[#34495e] py-5 text-lg font-bold tracking-wide text-white transition-all hover:opacity-90"
                >
                  <FileText className="h-5 w-5" />
                  {t("header.menu.createQuote")}
                </Link>

                {product.technicalPdf ? (
                  <a
                    href={product.technicalPdf}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-4 font-bold text-[#1d3246] transition-colors hover:bg-[#f2f4f6]"
                  >
                    <FileText className="h-5 w-5" />
                    {resolveText(t, "productDetail.downloadTechnical", "Teknik dokuman indir")}
                  </a>
                ) : (
                  <Link
                    href={categoryHref}
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-4 font-bold text-[#1d3246] transition-colors hover:bg-[#f2f4f6]"
                  >
                    {t("productDetail.backToCategories")}
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center justify-around rounded-xl bg-[#f2f4f6] p-6">
              <div className="text-center">
                <BadgeCheck className="mx-auto mb-2 h-7 w-7 text-[#1d3246]" />
                <p className="text-[10px] font-bold uppercase tracking-tight">
                  {resolveText(t, "productDetail.badges.verified", "Katalog dogrulandi")}
                </p>
              </div>

              <div className="h-8 w-px bg-[#c3c7cd]" />

              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-[#1d3246]" />
                <p className="text-[10px] font-bold uppercase tracking-tight">
                  {resolveText(t, "productDetail.badges.live", "Canli veri")}
                </p>
              </div>

              <div className="h-8 w-px bg-[#c3c7cd]" />

              <div className="text-center">
                <Truck className="mx-auto mb-2 h-7 w-7 text-[#1d3246]" />
                <p className="text-[10px] font-bold uppercase tracking-tight">
                  {resolveText(t, "productDetail.badges.fastQuote", "Hizli teklif")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24">
          <div className="flex overflow-x-auto border-b border-[#e6e8ea]">
            <button className="whitespace-nowrap border-b-4 border-[#1d3246] px-8 py-4 font-bold text-[#1d3246]">
              {t("productDetail.tabs.description")}
            </button>
            <button className="whitespace-nowrap px-8 py-4 font-medium text-slate-500">
              {t("productDetail.tabs.specs")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-16 py-12 md:grid-cols-2">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-[#1d3246]">{t("productDetail.tabs.description")}</h3>

              <p className="whitespace-pre-line leading-relaxed text-slate-600">
                {product.description || resolveText(t, "productDetail.noDescription", "Aciklama bulunmuyor.")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/50 bg-[#f2f4f6] p-8 backdrop-blur-sm">
              <div className="mb-6 flex items-start gap-4">
                <div className="rounded-lg bg-[#1d3246] p-3 text-white">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#1d3246]">
                    {resolveText(t, "productDetail.info.professionalTitle", "Profesyonel kullanim")}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {resolveText(
                      t,
                      "productDetail.info.professionalText",
                      "Urun karti katalog verisiyle dinamik uretilir ve hizli teklif surecini destekler."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-[#1d3246] p-3 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#1d3246]">
                    {resolveText(t, "productDetail.info.consistencyTitle", "Katalog tutarliligi")}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {resolveText(
                      t,
                      "productDetail.info.consistencyText",
                      "Gorseller, aciklama ve teknik alanlar tek veri kaynagindan okunur."
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {technicalSpecsText || specs.length ? (
            <div className="mt-4 rounded-2xl bg-white p-8 shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
              <h2 className="mb-6 text-2xl font-extrabold text-[#1d3246]">
                {t("productDetail.tabs.specs")}
              </h2>

              {technicalSpecsText ? (
                <div className="mb-6 rounded-xl border border-[#e6e8ea] bg-[#f8f9fb] px-5 py-4">
                  <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    {t("productDetail.tabs.specs")}
                  </div>
                  <div className="whitespace-pre-line text-[15px] leading-7 text-[#1d3246]">
                    {technicalSpecsText}
                  </div>
                </div>
              ) : null}

              {specs.length ? (
                <div className="overflow-hidden rounded-xl border border-[#e6e8ea]">
                  {specs.map(([label, value], index) => (
                    <div
                      key={`${label}-${index}`}
                      className={`grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] ${
                        index % 2 === 1 ? "bg-[#f2f4f6]" : "bg-white"
                      }`}
                    >
                      <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        {label}
                      </div>
                      <div className="text-[15px] font-medium text-[#1d3246]">{value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <RelatedProducts products={relatedProducts} />
      </div>
    </section>
  );
}
