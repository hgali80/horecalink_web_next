// app/components/HeroSection.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage";
import { app } from "../../firebase";
import { useLang } from "../context/LanguageContext";

export default function HeroSection() {
  const { t } = useLang();

  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ✅ SADECE 3 ANA GRUP
  const categories = [
    {
      key: "kurumsal",
      title: t("home.hero.category.kurumsal") ?? "Kurumsal",
      desc:
        t("home.categories.kurumsalDesc") ??
        "Kurumsal tesisler için profesyonel tüketim ve hijyen ürünleri.",
      image: "/kart_kurumsal.jpg",
      link: "/categories?group=institutional",
      btn: t("home.categories.btn") ?? "Çözümlere Göz At",
    },
    {
      key: "ekipman",
      title: t("home.hero.category.yatirim") ?? "Ekipman",
      desc:
        t("home.categories.ekipmanDesc") ??
        "Otel, restoran ve kafe için ekipman ve makineler.",
      image: "/kart_yatirim.jpg",
      link: "/categories?group=equipment",
      btn: t("home.categories.btn2") ?? "Ekipmanları Gör",
    },
    {
      key: "paslanmaz",
      title: t("home.hero.category.paslanmaz") ?? "Paslanmaz",
      desc:
        t("home.categories.paslanmazDesc") ??
        "Endüstriyel sınıf paslanmaz çelik ürünler ve özel imalat.",
      image: "/kart_paslanmaz.jpg",
      link: "/categories?group=stainless_steel",
      btn: t("home.categories.btn3") ?? "Endüstriyel Ürünler",
    },
  ];

  // 🔹 Firebase banner çekme (korundu)
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

  // 🔹 Otomatik slider
  useEffect(() => {
    if (heroImages.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages]);

  return (
    <>
      {/* HERO (hedef arayüz gibi) */}
      <section className="relative w-full h-[520px] md:h-[600px] lg:h-[650px] flex items-center overflow-hidden">
        {/* background slider */}
        <div className="absolute inset-0 z-0">
          {isLoading ? (
            <div className="w-full h-full bg-slate-200" />
          ) : heroImages.length > 0 ? (
            heroImages.map((image, idx) => (
              <Image
                key={image}
                src={image}
                alt={`Hero banner ${idx + 1}`}
                fill
                priority={idx === 0}
                className={`object-cover transition-opacity duration-700 ${
                  idx === activeIndex ? "opacity-100" : "opacity-0"
                }`}
                sizes="100vw"
              />
            ))
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#003366] via-[#003366]/70 to-transparent" />
          )}

          {/* overlay gradient like target */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#003366]/90 via-[#003366]/60 to-transparent" />
        </div>

        {/* content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-2xl">
            <span className="inline-block py-1 px-3 rounded-full bg-amber-500/20 text-amber-400 font-extrabold text-xs uppercase tracking-widest mb-6">
              {t("home.hero.badge") ?? "Premium HORECA Tedarikçisi"}
            </span>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6">
              {t("home.hero.title1") ?? "HORECA Sektörü"}{" "}
              <br className="hidden sm:block" />
              {t("home.hero.title2") ?? "İçin"}{" "}
              <span className="text-amber-400">
                {t("home.hero.titleAccent") ?? "Tam Çözümler"}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-200 mb-10 font-medium">
              {t("home.hero.desc") ??
                "Otel, restoran ve kafeler için yüksek kaliteli ekipmanlar ve profesyonel tedarik çözümleri. Performans ve mükemmellik için tasarlandı."}
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/categories"
                className="bg-amber-500 text-[#003366] px-8 py-4 rounded-lg font-extrabold text-lg hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20"
              >
                {t("home.hero.cta1") ?? "Kataloğu İncele"}
              </Link>

              <Link
                href="/contact"
                className="bg-white/10 backdrop-blur-md text-white border border-white/30 px-8 py-4 rounded-lg font-extrabold text-lg hover:bg-white/20 transition-all"
              >
                {t("home.hero.cta2") ?? "Projelerimiz"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ANA KATEGORİLER (hedefteki gibi ayrı bölüm) */}
      <section className="py-20 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl font-extrabold text-[#003366] mb-2">
              {t("home.categories.title") ?? "Ana Kategorilerimiz"}
            </h2>
            <div className="h-1.5 w-20 bg-amber-500 rounded-full" />
          </div>

          <Link
            href="/categories"
            className="text-[#003366] font-bold flex items-center gap-2 hover:gap-3 transition-all"
          >
            {t("home.categories.all") ?? "Tüm Kategorileri Gör"} <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {categories.map((cat) => (
            <div
              key={cat.key}
              className="group relative h-[360px] md:h-[400px] rounded-2xl overflow-hidden shadow-xl hover:-translate-y-2 transition-all duration-500"
            >
              <Image
                alt={cat.title}
                src={cat.image}
                fill
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, 33vw"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-[#003366]/90 transition-colors duration-500" />

              <div className="absolute bottom-0 left-0 p-8">
                <h3 className="text-white text-3xl font-extrabold mb-3">
                  {cat.title}
                </h3>

                <p className="text-slate-200 text-sm mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 max-w-[28ch]">
                  {cat.desc}
                </p>

                <Link
                  href={cat.link}
                  className="inline-block bg-white text-[#003366] px-6 py-2 rounded-lg font-bold text-sm transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500"
                >
                  {cat.btn}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
