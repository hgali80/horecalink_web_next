import { notFound } from "next/navigation";

import ProductDetailClient from "./ProductDetailClient";
import {
  getProductBySlug,
  getRelatedProducts,
} from "../../lib/firestore/products";
import { hydrateProductImageNames } from "../../lib/server/productImages";

const BASE_URL = "https://horecalink.kz";
const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

function getProductName(product) {
  return (
    cleanText(product?.name) ||
    cleanText(product?.name_ru) ||
    cleanText(product?.name_tr) ||
    "HorecaLink"
  );
}

function getProductDescription(product) {
  return (
    cleanText(product?.shortDescription) ||
    cleanText(product?.description) ||
    cleanText(product?.searchText) ||
    "Профессиональное оборудование и товары HoReCa с доставкой по Казахстану."
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

function getProductUrl(product) {
  const slug = cleanText(product?.slug) || cleanText(product?.id);
  return `${BASE_URL}/products/${slug}`;
}

function getImageUrls(product) {
  const imageNames = Array.isArray(product?.image_names)
    ? product.image_names.filter(Boolean)
    : [];

  return imageNames.map((imageName) => {
    const fileName = /\.[a-z0-9]+$/i.test(imageName) ? imageName : `${imageName}.jpg`;
    return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(
      fileName
    )}?alt=media`;
  });
}

function getKeywordList(product) {
  const tags = Array.isArray(product?.tags) ? product.tags : [];
  const searchTerms = cleanText(product?.searchText)
    .split(/[\n,;]+/)
    .map((item) => cleanText(item))
    .filter(Boolean);

  return Array.from(
    new Set(
      [
        ...tags,
        ...searchTerms,
        cleanText(product?.brand),
        cleanText(product?.category),
        cleanText(product?.subcategory),
      ].filter(Boolean)
    )
  ).slice(0, 20);
}

function buildProductJsonLd(product) {
  const name = getProductName(product);
  const description = getProductDescription(product);
  const image = getImageUrls(product);
  const sku = getProductCode(product);
  const price = Number(product?.price);
  const brand = cleanText(product?.brand);
  const unit = cleanText(product?.unit);
  const category = [cleanText(product?.group), cleanText(product?.category), cleanText(product?.subcategory)]
    .filter(Boolean)
    .join(" > ");
  const hasValidOffer = Number.isFinite(price) && price > 0;

  // Only emit Product rich-result markup when we have the minimum data Google
  // expects for eligible product snippets. Otherwise Search Console reports a
  // critical schema error for pages that intentionally hide pricing.
  if (!hasValidOffer) {
    return null;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    sku,
    mpn: cleanText(product?.manufacturerCode) || sku,
    image: image.length ? image : undefined,
    brand: brand
      ? {
          "@type": "Brand",
          name: brand,
        }
      : undefined,
    category: category || undefined,
    additionalProperty: [
      ["Код товара", sku],
      ["Единица", unit],
      ["Материал", cleanText(product?.material)],
      ["Размеры", cleanText(product?.dimensions)],
      ["Мощность", cleanText(product?.power)],
      ["Напряжение", cleanText(product?.voltage)],
      ["Тип топлива", cleanText(product?.fuelType)],
      ["Гарантия", cleanText(product?.warranty)],
    ]
      .filter(([, value]) => value)
      .map(([name, value]) => ({
        "@type": "PropertyValue",
        name,
        value,
      })),
    offers: {
      "@type": "Offer",
      url: getProductUrl(product),
      priceCurrency: "KZT",
      price: String(price),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return jsonLd;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Товар не найден",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const hydratedProduct = await hydrateProductImageNames(product);
  const title = getProductName(hydratedProduct);
  const description = getProductDescription(hydratedProduct);
  const canonical = getProductUrl(hydratedProduct);
  const images = getImageUrls(hydratedProduct);
  const keywords = getKeywordList(hydratedProduct);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      locale: "ru_KZ",
      images: images.length
        ? images.map((url) => ({
            url,
            alt: title,
          }))
        : undefined,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title,
      description,
      images: images.length ? images : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const hydratedProduct = await hydrateProductImageNames(product);
  const relatedProducts = await getRelatedProducts(hydratedProduct, 8);
  const productJsonLd = buildProductJsonLd(hydratedProduct);

  return (
    <>
      {productJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      ) : null}
      <ProductDetailClient product={hydratedProduct} relatedProducts={relatedProducts} />
    </>
  );
}
