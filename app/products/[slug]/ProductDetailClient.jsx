"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  FileText,
  Package2,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";

import ProductGallery from "../../components/ProductGallery";
import ProductQuoteActions from "../../components/ProductQuoteActions";
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
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatPriceWithDecimal(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(numeric);
}

function asNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

function normalizeUnitType(value, t) {
  const clean = cleanText(value).toLowerCase();
  if (!clean) return "";

  const labels = {
    roll: resolveText(t, "productDetail.packaging.unitType.roll", "roll"),
    piece: resolveText(t, "productDetail.packaging.unitType.piece", "piece"),
    ml: resolveText(t, "productDetail.packaging.unitType.ml", "ml"),
    kg: resolveText(t, "productDetail.packaging.unitType.kg", "kg"),
  };

  return labels[clean] || clean;
}

function buildPackagingSummary(product, t) {
  const price = asNumber(product?.price);
  const packQty = asNumber(product?.packQty);
  const caseQty = asNumber(product?.caseQty);
  const unitType = normalizeUnitType(product?.unitType, t);
  const totalUnits = packQty && caseQty ? packQty * caseQty : null;
  const pricePerPack = price && caseQty ? price / caseQty : null;
  const pricePerUnit = price && totalUnits ? price / totalUnits : null;
  const hasPackagingData =
    Number.isFinite(packQty) || Number.isFinite(caseQty) || Boolean(cleanText(product?.unitType));

  if (!hasPackagingData) return null;

  const chips = [];

  if (caseQty) {
    chips.push({
      label: resolveText(t, "productDetail.packaging.caseQty", "Packs per case"),
      value: `${caseQty}`,
    });
  }

  if (packQty) {
    chips.push({
      label: resolveText(t, "productDetail.packaging.packQty", "Units per pack"),
      value: unitType ? `${packQty} ${unitType}` : `${packQty}`,
    });
  }

  if (totalUnits) {
    chips.push({
      label: resolveText(t, "productDetail.packaging.totalUnits", "Total units in case"),
      value: unitType ? `${totalUnits} ${unitType}` : `${totalUnits}`,
    });
  }

  const microLines = [];

  if (pricePerPack) {
    microLines.push(
      `${resolveText(t, "productDetail.packaging.perPack", "Per pack")}: ${formatPriceWithDecimal(pricePerPack)} ₸`
    );
  }

  if (pricePerUnit) {
    const suffix = unitType || resolveText(t, "productDetail.packaging.unit", "unit");
    microLines.push(
      `${resolveText(t, "productDetail.packaging.perUnit", "Per unit")}: ${formatPriceWithDecimal(pricePerUnit)} ₸ / ${suffix}`
    );
  }

  return {
    isPaperProduct: cleanText(product?.categoryKey) === "paper-products",
    title: resolveText(t, "productDetail.packaging.title", "Commercial packaging"),
    subtitle: resolveText(
      t,
      "productDetail.packaging.subtitle",
      "Case-pack structure and unit economics"
    ),
    chips,
    microLines,
  };
}

export default function ProductDetailClient({ product, relatedProducts }) {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState("description");
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
  const packagingSummary = buildPackagingSummary(product, t);

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

              {packagingSummary ? (
                <div
                  className={`mb-8 overflow-hidden rounded-2xl border ${
                    packagingSummary.isPaperProduct
                      ? "border-[#d7e4ec] bg-gradient-to-br from-[#f4f8fb] via-white to-[#eef4f7]"
                      : "border-[#e6e8ea] bg-white"
                  }`}
                >
                  <div className="flex items-start gap-4 p-5">
                    <div className="rounded-2xl bg-[#1d3246] p-3 text-white">
                      <Package2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-[#1d3246]">
                        {packagingSummary.subtitle}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-px bg-[#e6e8ea] sm:grid-cols-2">
                    {packagingSummary.chips.map((item) => (
                      <div key={item.label} className="bg-white px-5 py-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          {item.label}
                        </div>
                        <div className="mt-1 text-base font-bold text-[#1d3246]">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {packagingSummary.microLines.length ? (
                    <div className="flex flex-wrap gap-3 border-t border-[#e6e8ea] px-5 py-4 text-sm font-medium text-slate-600">
                      {packagingSummary.microLines.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

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
                    <span className="text-xl font-bold text-slate-500">{t("productcard.noPrice")}</span>
                  )}
                </div>

                <ProductQuoteActions product={product} showRequestButton />

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
            <button
              type="button"
              onClick={() => setActiveTab("description")}
              className={`whitespace-nowrap px-8 py-4 ${
                activeTab === "description"
                  ? "border-b-4 border-[#1d3246] font-bold text-[#1d3246]"
                  : "font-medium text-slate-500"
              }`}
            >
              {t("productDetail.tabs.description")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              className={`whitespace-nowrap px-8 py-4 ${
                activeTab === "specs"
                  ? "border-b-4 border-[#1d3246] font-bold text-[#1d3246]"
                  : "font-medium text-slate-500"
              }`}
            >
              {t("productDetail.tabs.specs")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-16 py-12 md:grid-cols-2">
            {activeTab === "description" ? (
              <>
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
              </>
            ) : (
              <>
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-[#1d3246]">{t("productDetail.tabs.specs")}</h3>

                  <div className="rounded-2xl border border-[#e6e8ea] bg-white p-6 shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
                    <div className="whitespace-pre-line text-[15px] leading-7 text-slate-600">
                      {technicalSpecsText || resolveText(t, "productDetail.noDescription", "Aciklama bulunmuyor.")}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e6e8ea] bg-[#f8f9fb] p-8">
                  <div className="mb-6 flex items-start gap-4">
                    <div className="rounded-lg bg-[#1d3246] p-3 text-white">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1d3246]">{t("productDetail.tabs.specs")}</h4>
                      <p className="text-sm text-slate-600">
                        {resolveText(
                          t,
                          "productDetail.info.consistencyText",
                          "Gorseller, aciklama ve teknik alanlar tek veri kaynagindan okunur."
                        )}
                      </p>
                    </div>
                  </div>

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
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#d7dce2] bg-white px-5 py-4 text-sm text-slate-500">
                      {technicalSpecsText
                        ? resolveText(t, "productDetail.tabs.specs", "Teknik Ozellikler")
                        : resolveText(t, "productDetail.noDescription", "Aciklama bulunmuyor.")}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <RelatedProducts products={relatedProducts} />
      </div>
    </section>
  );
}

