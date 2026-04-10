//app/components/ProductGallery.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Package2, PlayCircle } from "lucide-react";
import { useLang } from "../context/LanguageContext";

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";
const MAX_AUTO_IMAGES = 12;

function getImageUrl(imageName) {
  if (!imageName) return null;

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(
    imageName
  )}?alt=media`;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

function ensureImageExtension(value) {
  const text = cleanText(value);
  if (!text) return "";
  return /\.[a-z0-9]+$/i.test(text) ? text : `${text}.jpg`;
}

function toImageStem(value) {
  return cleanText(value).replace(/\.[a-z0-9]+$/i, "");
}

function getImageCandidates(product) {
  const existingNames = Array.isArray(product?.image_names)
    ? product.image_names.map((item) => ensureImageExtension(item)).filter(Boolean)
    : [];

  const baseStem =
    toImageStem(product?.stock_code) ||
    toImageStem(product?.imageBase) ||
    toImageStem(product?.sku) ||
    toImageStem(product?.manufacturerCode) ||
    toImageStem(product?.id);

  if (!baseStem) return Array.from(new Set(existingNames));

  const generatedNames = Array.from(
    { length: MAX_AUTO_IMAGES },
    (_, index) => (index === 0 ? `${baseStem}.jpg` : `${baseStem}-${index}.jpg`)
  );

  return Array.from(new Set([...existingNames, ...generatedNames]));
}

function probeImage(imageName) {
  const imageUrl = getImageUrl(imageName);

  return new Promise((resolve) => {
    if (!imageUrl || typeof window === "undefined") {
      resolve(false);
      return;
    }

    const img = new window.Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = imageUrl;
  });
}

export default function ProductGallery({ product }) {
  const { t } = useLang();
  const candidateImages = useMemo(() => getImageCandidates(product), [product]);
  const fallbackImages = useMemo(
    () => candidateImages.slice(0, 1),
    [candidateImages]
  );
  const [images, setImages] = useState(fallbackImages);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setImages(fallbackImages);
    setSelectedIndex(0);

    async function discoverImages() {
      if (!candidateImages.length) {
        if (!cancelled) setImages([]);
        return;
      }

      const results = await Promise.all(
        candidateImages.map(async (imageName) => ({
          imageName,
          exists: await probeImage(imageName),
        }))
      );

      if (cancelled) return;

      const discoveredImages = results
        .filter((item) => item.exists)
        .map((item) => item.imageName);

      setImages(discoveredImages.length ? discoveredImages : fallbackImages);
    }

    discoverImages();

    return () => {
      cancelled = true;
    };
  }, [candidateImages, fallbackImages]);

  const selectedImage = images[selectedIndex] || "";
  const selectedImageUrl = getImageUrl(selectedImage);

  return (
    <div className="space-y-4">
      <div className="aspect-square overflow-hidden rounded-xl bg-white shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
        <div className="relative h-full w-full">
          {selectedImageUrl ? (
            <Image
              src={selectedImageUrl}
              alt={product?.name || "Product image"}
              fill
              unoptimized
              className="object-contain p-8"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#f2f4f6]">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Package2 className="h-12 w-12" strokeWidth={1.75} />
                <span className="text-sm font-medium">{t("productDetail.noImage")}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {images.slice(0, 4).map((imageName, index) => {
          const imageUrl = getImageUrl(imageName);
          const active = index === selectedIndex;

          return (
            <button
              key={`${imageName}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`aspect-square overflow-hidden rounded-lg transition ${
                active ? "border-2 border-[#34495E] bg-white" : "bg-white hover:opacity-80"
              }`}
              aria-label={t("productDetail.openImage", { index: index + 1 })}
            >
              <div className="relative h-full w-full">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={`${product?.name || "Product"} ${index + 1}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : null}
              </div>
            </button>
          );
        })}

        <div className="flex aspect-square items-center justify-center rounded-lg bg-[#eceef0] text-slate-500">
          <PlayCircle className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
