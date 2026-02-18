// app/components/HeroSection.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage";
import { app } from "../../firebase";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "../context/LanguageContext";

export default function HeroSection() {
  const { t } = useLang();

  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 🔹 Kategoriler (URL’ler DİLSİZ)
  const categories = [
  {
    key: "k_",
    title: t("home.hero.category.kurumsal"),
    image: "/kart_kurumsal.jpg",
    link: "/categories?group=institutional",
  },
  {
    key: "y_",
    title: t("home.hero.category.yatirim"),
    image: "/kart_yatirim.jpg",
    link: "/categories?group=equipment", // ✅ İngilizce
  },
  {
    key: "p_",
    title: t("home.hero.category.paslanmaz"),
    image: "/kart_paslanmaz.jpg",
    link: "/categories?group=stainless_steel" // ✅ İngilizce
  },

  // şimdilik dokunmuyoruz
  {
    key: "kim_",
    title: t("home.hero.category.kimyasallar"),
    image: "/kart_kimyasallar.jpg",
    link: "/categories?group=institutional",
  },
  {
    key: "cop_",
    title: t("home.hero.category.ambalaj"),
    image: "/kart_cop.jpg",
    link: "/categories?group=institutional",
  },
];





  // 🔹 Firebase banner çekme (AYNEN KORUNDU)
  const fetchHeroImages = useCallback(async () => {
    try {
      setIsLoading(true);

      const storage = getStorage(app);
      const folderRef = ref(storage, "banners_web");
      const res = await listAll(folderRef);

      const urls: string[] = await Promise.all(
        res.items.map((itemRef) => getDownloadURL(itemRef))
      );

      setHeroImages(urls.sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      console.error("⚠️ Banner alınamadı:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeroImages();
  }, [fetchHeroImages]);

  // 🔹 Otomatik slider (AYNEN)
  useEffect(() => {
    if (heroImages.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroImages]);

  // 🔹 Manuel slide (AYNEN)
  const changeSlide = (direction: "prev" | "next") => {
    if (heroImages.length <= 1) return;

    setActiveIndex((prev) =>
      direction === "next"
        ? (prev + 1) % heroImages.length
        : (prev - 1 + heroImages.length) % heroImages.length
    );
  };

  return (
    <section className="w-full bg-white">
      <div className="relative w-full h-[220px] md:h-[300px] lg:h-[400px] overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
            <div className="animate-pulse text-gray-600">
              {t("hero.loading")}
            </div>
          </div>
        ) : heroImages.length > 0 ? (
          heroImages.map((image, index) => (
            <Image
              key={image}
              src={image}
              alt={`Hero banner ${index + 1}`}
              fill
              priority={index === 0}
              className={`object-cover transition-opacity duration-700 ${
                index === activeIndex ? "opacity-100" : "opacity-0"
              }`}
              sizes="100vw"
            />
          ))
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-700 flex items-center justify-center text-white">
            {t("hero.noImage")}
          </div>
        )}

        {/* Oklar */}
        {heroImages.length > 1 && (
          <>
            <button
              onClick={() => changeSlide("prev")}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/60 p-2 rounded-full transition-colors"
              aria-label={t("hero.prev")}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => changeSlide("next")}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/60 p-2 rounded-full transition-colors"
              aria-label={t("hero.next")}
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-[1px] bg-gray-200">
        {categories.map((cat) => (
          <Link
            href={cat.link}
            key={cat.key}
            className="relative h-[180px] md:h-[240px] overflow-hidden group block"
          >
            <Image
              src={cat.image}
              alt={cat.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              sizes="(max-width: 768px) 50vw, 20vw"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex flex-col items-center justify-center text-white p-4 transition-colors">
              <h3 className="text-lg md:text-2xl font-semibold mb-2 text-center">
                {cat.title}
              </h3>
              <span className="bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs md:text-sm rounded transition-colors">
                {t("hero.viewProducts")}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
