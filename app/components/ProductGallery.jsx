//app/components/ProductGallery.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Package2, PlayCircle, X } from "lucide-react";
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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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
  const hasMultipleImages = images.length > 1;

  function goToPreviousImage() {
    setSelectedIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
  }

  function goToNextImage() {
    setSelectedIndex((current) =>
      current === images.length - 1 ? 0 : current + 1
    );
  }

  return (
    <>
      <div className="space-y-4">
      <div className="aspect-square overflow-hidden rounded-xl bg-white shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
        <button
          type="button"
          className="relative h-full w-full cursor-zoom-in"
          onClick={() => {
            if (selectedImageUrl) setIsLightboxOpen(true);
          }}
          aria-label={product?.name || "Product image"}
        >
          {selectedImageUrl ? (
            <Image
              src={selectedImageUrl}
              alt={product?.name || "Product image"}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-contain object-center p-6"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#f2f4f6]">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Package2 className="h-12 w-12" strokeWidth={1.75} />
                <span className="text-sm font-medium">{t("productDetail.noImage")}</span>
              </div>
            </div>
          )}
        </button>
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

      {isLightboxOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
            aria-label="Close full screen image"
          >
            <X className="h-6 w-6" />
          </button>

          {hasMultipleImages ? (
            <button
              type="button"
              onClick={goToPreviousImage}
              className="absolute left-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}

          <div className="relative h-[85vh] w-full max-w-6xl">
            {selectedImageUrl ? (
              <Image
                src={selectedImageUrl}
                alt={product?.name || "Product image"}
                fill
                unoptimized
                sizes="100vw"
                className="object-contain object-center"
              />
            ) : null}
          </div>

          {hasMultipleImages ? (
            <button
              type="button"
              onClick={goToNextImage}
              className="absolute right-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
