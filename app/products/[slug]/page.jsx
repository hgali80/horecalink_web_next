//app/products/[slug]/page.jsx
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  FileText,
  BadgeCheck,
  ShieldCheck,
  Truck,
  PackageCheck,
  Wrench,
  Sparkles,
} from "lucide-react";

import ProductGallery from "../../components/ProductGallery";
import RelatedProducts from "../../components/RelatedProducts";
import {
  getProductBySlug,
  getRelatedProducts,
} from "../../lib/firestore/products";

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (text.toLowerCase() === "null") return "";
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

function buildSpecs(product) {
  const specs = [
    [
      "Код",
      cleanText(product?.manufacturerCode) ||
        cleanText(product?.sku) ||
        cleanText(product?.id),
    ],
    ["Бренд", cleanText(product?.brand)],
    ["Единица", cleanText(product?.unit)],
    ["Материал", cleanText(product?.material)],
    ["Размеры", cleanText(product?.dimensions)],
    ["Объем", cleanText(product?.capacity)],
    ["Мощность", cleanText(product?.power)],
    ["Напряжение", cleanText(product?.voltage)],
    ["Тип топлива", cleanText(product?.fuelType)],
    ["Гарантия", cleanText(product?.warranty)],
  ];

  return specs.filter(([, value]) => value);
}

function buildHighlights(product) {
  const items = [];

  if (cleanText(product?.material)) {
    items.push({
      icon: ShieldCheck,
      title: "Материал",
      text: cleanText(product.material),
    });
  }

  if (cleanText(product?.dimensions)) {
    items.push({
      icon: Wrench,
      title: "Размеры",
      text: cleanText(product.dimensions),
    });
  }

  if (cleanText(product?.warranty)) {
    items.push({
      icon: BadgeCheck,
      title: "Гарантия",
      text: cleanText(product.warranty),
    });
  }

  if (cleanText(product?.power) || cleanText(product?.voltage)) {
    items.push({
      icon: PackageCheck,
      title: "Тех. параметры",
      text:
        [cleanText(product?.power), cleanText(product?.voltage)]
          .filter(Boolean)
          .join(" / ") || "Уточняется",
    });
  }

  if (!items.length) {
    items.push(
      {
        icon: ShieldCheck,
        title: "Профессиональный подбор",
        text: "Подходит для интенсивного использования в HoReCa сегменте.",
      },
      {
        icon: Sparkles,
        title: "Актуальные данные",
        text: "Карточка автоматически формируется из Firestore каталога.",
      },
      {
        icon: Truck,
        title: "Быстрый запрос КП",
        text: "Отправка заявки на коммерческое предложение в один клик.",
      }
    );
  }

  return items.slice(0, 4);
}

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product, 8);
  const specs = buildSpecs(product);
  const highlights = buildHighlights(product);
  const formattedPrice = formatPrice(product?.price);

  const groupKey = cleanText(product?.groupKey);
  const categoryKey = cleanText(product?.categoryKey);
  const subcategoryKey = cleanText(product?.subcategoryKey);

  const categoryHref =
    groupKey && categoryKey && subcategoryKey
      ? `/catalog/${groupKey}/${categoryKey}/${subcategoryKey}`
      : "/";

  const code =
    cleanText(product?.manufacturerCode) ||
    cleanText(product?.sku) ||
    cleanText(product?.id);

  return (
    <section className="bg-[#f8f9fb] pb-20 pt-24 text-[#191c1e]">
      <div className="mx-auto max-w-[1440px] px-6">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link href="/" className="transition-colors hover:text-[#1d3246]">
            Ana Sayfa
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/products" className="transition-colors hover:text-[#1d3246]">
            Ürünler
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={categoryHref} className="transition-colors hover:text-[#1d3246]">
            Katalog
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-bold text-[#1d3246]">
            {product.name || product.name_tr || "Товар"}
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

                {product.isNew ? (
                  <span className="rounded-sm border border-[#c3c7cd] bg-[#eceef0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1d3246]">
                    Yeni
                  </span>
                ) : null}
              </div>

              <h1 className="mb-2 text-2xl md:text-3xl lg:text-4xl font-semibold leading-[1.2] tracking-[-0.02em] text-[#1d3246]">
                {product.name || product.name_tr || "Товар"}
              </h1>

              <p className="mb-6 text-sm font-semibold text-slate-500">
                Kod: {code || "-"}
              </p>

              <p className="mb-8 text-lg leading-relaxed text-slate-600">
                {product.shortDescription ||
                  "Profesyonel kullanım için katalogdan otomatik oluşturulan ürün detay kartı."}
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
                        / {product.unit || "шт"}
                      </span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-slate-500">
                      Цена по запросу
                    </span>
                  )}
                </div>

                <Link
                  href={`/teklif-talep?productId=${encodeURIComponent(product.id || "")}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#1d3246] to-[#34495e] py-5 text-lg font-bold tracking-wide text-white transition-all hover:opacity-90"
                >
                  <FileText className="h-5 w-5" />
                  TEKLİF İSTE
                </Link>

                {product.technicalPdf ? (
                  <a
                    href={product.technicalPdf}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-4 font-bold text-[#1d3246] transition-colors hover:bg-[#f2f4f6]"
                  >
                    <FileText className="h-5 w-5" />
                    Teknik Döküman İndir
                  </a>
                ) : (
                  <Link
                    href={categoryHref}
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-4 font-bold text-[#1d3246] transition-colors hover:bg-[#f2f4f6]"
                  >
                    Kataloğa Dön
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center justify-around rounded-xl bg-[#f2f4f6] p-6">
              <div className="text-center">
                <BadgeCheck className="mx-auto mb-2 h-7 w-7 text-[#1d3246]" />
                <p className="text-[10px] font-bold uppercase tracking-tight">
                  Katalog Doğrulandı
                </p>
              </div>

              <div className="h-8 w-px bg-[#c3c7cd]" />

              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-[#1d3246]" />
                <p className="text-[10px] font-bold uppercase tracking-tight">
                  Firestore Canlı
                </p>
              </div>

              <div className="h-8 w-px bg-[#c3c7cd]" />

              <div className="text-center">
                <Truck className="mx-auto mb-2 h-7 w-7 text-[#1d3246]" />
                <p className="text-[10px] font-bold uppercase tracking-tight">
                  Hızlı Teklif
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24">
          <div className="flex overflow-x-auto border-b border-[#e6e8ea]">
            <button className="whitespace-nowrap border-b-4 border-[#1d3246] px-8 py-4 font-bold text-[#1d3246]">
              Ürün Açıklaması
            </button>
            <button className="whitespace-nowrap px-8 py-4 font-medium text-slate-500">
              Teknik Özellikler
            </button>
            <button className="whitespace-nowrap px-8 py-4 font-medium text-slate-500">
              Belgeler & Sertifikalar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-16 py-12 md:grid-cols-2">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-[#1d3246]">
                Ürün Detayı
              </h3>

              <p className="whitespace-pre-line leading-relaxed text-slate-600">
                {product.description || "Açıklama bulunmuyor."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/50 bg-[#f2f4f6] p-8 backdrop-blur-sm">
              <div className="mb-6 flex items-start gap-4">
                <div className="rounded-lg bg-[#1d3246] p-3 text-white">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#1d3246]">Profesyonel Kullanım</h4>
                  <p className="text-sm text-slate-600">
                    Ürün kartı katalog verisiyle dinamik üretilir. HoReCa operasyonları
                    için hızlı teklif ve düzenli ürün sunumu sağlar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-[#1d3246] p-3 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#1d3246]">Katalog Tutarlılığı</h4>
                  <p className="text-sm text-slate-600">
                    Görseller, açıklama, teknik alanlar ve ilgili ürünler tek veri
                    kaynağından okunur. Dummy veri kullanılmaz.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {specs.length ? (
            <div className="mt-4 rounded-2xl bg-white p-8 shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
              <h2 className="mb-6 text-2xl font-extrabold text-[#1d3246]">
                Teknik Özellikler
              </h2>

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
                    <div className="text-[15px] font-medium text-[#1d3246]">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <RelatedProducts products={relatedProducts} />
      </div>
    </section>
  );
}