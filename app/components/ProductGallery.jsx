//app/components/ProductGallery.jsx
"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Package2, PlayCircle } from "lucide-react";

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";

function getImageUrl(imageName) {
  if (!imageName) return null;

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(
    imageName
  )}?alt=media`;
}

export default function ProductGallery({ product }) {
  const images = useMemo(() => {
    return Array.isArray(product?.image_names)
      ? product.image_names.filter(Boolean)
      : [];
  }, [product]);

  const [selectedIndex, setSelectedIndex] = useState(0);

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
                <span className="text-sm font-medium">Фото отсутствует</span>
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
                active
                  ? "border-2 border-[#34495E] bg-white"
                  : "bg-white hover:opacity-80"
              }`}
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