//app/components/ProductGallery.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Package2, PlayCircle, X } from "lucide-react";
import { useLang } from "../context/LanguageContext";

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";
const MAX_AUTO_IMAGES = 12;
const PLACEHOLDER_IMAGE = "/Placeholder.png";

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
  const [selectedImageFailed, setSelectedImageFailed] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    let cancelled = false;

    setImages(fallbackImages);
    setSelectedIndex(0);
    setSelectedImageFailed(false);
    setFailedImages({});

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
  const selectedImageUrl =
    !selectedImageFailed && selectedImage ? getImageUrl(selectedImage) : PLACEHOLDER_IMAGE;
  const hasMultipleImages = images.length > 1;
  const thumbnailItems = images.length ? images.slice(0, 4) : [PLACEHOLDER_IMAGE];

  function goToPreviousImage() {
    setSelectedIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
    setSelectedImageFailed(false);
  }

  function goToNextImage() {
    setSelectedIndex((current) =>
      current === images.length - 1 ? 0 : current + 1
    );
    setSelectedImageFailed(false);
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
          <Image
            src={selectedImageUrl}
            alt={product?.name || "Product image"}
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 60vw"
            onError={() => setSelectedImageFailed(true)}
            className="object-contain object-center p-6"
          />
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {thumbnailItems.map((imageName, index) => {
          const imageUrl =
            imageName === PLACEHOLDER_IMAGE || failedImages[imageName]
              ? PLACEHOLDER_IMAGE
              : getImageUrl(imageName);
          const active = images.length ? index === selectedIndex : index === 0;

          return (
            <button
              key={`${imageName}-${index}`}
              type="button"
              onClick={() => {
                if (!images.length) return;
                setSelectedIndex(index);
                setSelectedImageFailed(false);
              }}
              className={`aspect-square overflow-hidden rounded-lg transition ${
                active ? "border-2 border-[#34495E] bg-white" : "bg-white hover:opacity-80"
              }`}
              aria-label={
                images.length
                  ? t("productDetail.openImage", { index: index + 1 })
                  : t("productDetail.noImage")
              }
            >
              <div className="relative h-full w-full">
                <Image
                  src={imageUrl}
                  alt={`${product?.name || "Product"} ${index + 1}`}
                  fill
                  unoptimized
                  onError={() =>
                    setFailedImages((current) => ({
                      ...current,
                      [imageName]: true,
                    }))
                  }
                  className="object-cover"
                />
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
                onError={() => setSelectedImageFailed(true)}
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
