// app/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { ArrowRight, Grid3X3, Phone, Star } from "lucide-react";

import { db } from "../firebase";
import HeroSection from "./components/HeroSection";
import ProductCard from "./components/ProductCard";
import UsageAreasSection from "./components/UsageAreasSection";
import { useLang } from "./context/LanguageContext";

export default function Home() {
  const { t } = useLang();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const fetchFeatured = async () => {
      try {
        const q = query(
          collection(db, "products"),
          where("active", "==", true),
          where("webPublished", "==", true),
          where("featured", "==", true),
          orderBy("featuredOrder"),
          limit(20)
        );

        const snap = await getDocs(q);
        if (!alive) return;
        setFeaturedProducts(snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
      } catch (err) {
        console.error("Featured urunler alinamadi:", err);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    fetchFeatured();

    return () => {
      alive = false;
    };
  }, []);

  const categoryCards = useMemo(
    () => [
      {
        title: t("home.hero.category.kurumsal") || "Kurumsal Cozumler & Hijyen",
        desc:
          t("home.categories.kurumsal.desc") ||
          "Oteller ve tesisler icin endustriyel hijyen ve kurumsal sarf malzemeleri.",
        image: "/kart_kurumsal.jpg",
        href: "/catalog/institutional",
        cta: t("home.categories.kurumsal.cta") || "Urunleri Incele",
      },
      {
        title: t("home.hero.category.yatirim") || "Proje & Yatirim",
        desc:
          t("home.categories.yatirim.desc") ||
          "Yeni projeleriniz icin komple mutfak tasarimi ve anahtar teslim kurulumlar.",
        image: "/kart_yatirim.jpg",
        href: "/catalog/equipment",
        cta: t("home.categories.yatirim.cta") || "Cozumlere Goz At",
      },
      {
        title: t("home.hero.category.paslanmaz") || "Endustriyel Mutfak & Sarf",
        desc:
          t("home.categories.endustriyel.desc") ||
          "Gunluk operasyonlar icin dayanikli mutfak gerecleri ve paketleme urunleri.",
        image: "/kart_paslanmaz.jpg",
        href: "/catalog/paslanmaz",
        cta: t("home.categories.endustriyel.cta") || "Katalogu Gor",
      },
    ],
    [t]
  );

  const topFeatured = featuredProducts.slice(0, 4);

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-gray-900">
      <HeroSection />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 flex items-center gap-2 text-2xl font-bold text-[#003366]">
          <Grid3X3 size={22} />
          {t("home.categories.title") || "Ana Kategoriler"}
        </h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {categoryCards.map((cat) => (
            <div
              key={cat.href}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl shadow-lg transition-all duration-500 hover:shadow-2xl"
            >
              <Image
                src={cat.image}
                alt={cat.title}
                fill
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003366]/80 via-[#003366]/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-8 text-white">
                <h3 className="mb-4 text-2xl font-extrabold leading-tight">{cat.title}</h3>
                <p className="mb-6 line-clamp-2 text-sm text-slate-200">{cat.desc}</p>

                <Link
                  href={cat.href}
                  className="flex w-fit items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-[#003366] transition-colors hover:bg-slate-100"
                >
                  {cat.cta}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <UsageAreasSection />

      <section className="mx-auto mb-12 max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-[#003366]">
              <Star size={22} />
              {t("home.featured.title") || "One Cikan Urunler"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("home.featured.subtitle") ||
                "Sektörün en cok tercih edilen profesyonel ekipmanlari."}
            </p>
          </div>

          <Link
            href="/products"
            className="flex items-center gap-1 text-sm font-bold text-[#003366] hover:underline"
          >
            {t("home.featured.all") || "Tumunu Gor"}
            <ArrowRight size={18} />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-500">
            {t("home.featured.loading") || "Yukleniyor..."}
          </div>
        ) : topFeatured.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            {t("home.featured.empty") || "Urun bulunamadi."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {topFeatured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <a
        href="https://wa.me/77004446911"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition-all duration-300 hover:scale-110 hover:bg-[#128C7E] active:scale-95"
        aria-label="WhatsApp"
      >
        <Phone size={26} />
      </a>

      <footer className="bg-[#003366] px-4 py-16 text-slate-300">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-6 flex flex-col">
              <Image
                src="/horecalink_logo_footer.png"
                alt="HorecaLink Logo"
                width={260}
                height={47}
                className="object-contain"
                priority
              />
              <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("home.footer.tagline") || "bir Viroo Trade online platformudur"}
              </span>
            </div>

            <p className="max-w-sm text-sm leading-relaxed">
              {t("home.footer.about") ||
                "HorecaLink.kz, otel, restoran ve kafe profesyonelleri icin Kazakistan'in B2B tedarik ve proje platformudur."}
            </p>
          </div>

          <div>
            <h4 className="mb-6 text-lg font-bold text-white">
              {t("home.footer.corporate") || "Kurumsal"}
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link className="transition-colors hover:text-white" href="/about">
                  {t("header.menu.about")}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-white" href="/contact">
                  {t("header.menu.contact")}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-white" href="/privacy">
                  {t("home.footer.privacy") || "Gizlilik Politikasi"}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-lg font-bold text-white">
              {t("home.footer.infoTitle") || "Bilgi"}
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link className="transition-colors hover:text-white" href="/shipping">
                  {t("home.footer.shipping") || "Teslimat Bilgileri"}
                </Link>
              </li>
              <li>
                <Link
                  className="transition-colors hover:text-white"
                  href="/iade-politikasi"
                >
                  {t("returns.linkLabel")}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-white" href="/payment">
                  {t("home.footer.payment") || "Odeme Secenekleri"}
                </Link>
              </li>
              <li className="pt-4">
                <a
                  className="flex items-center gap-2 text-white transition-colors hover:text-blue-200"
                  href="tel:+77004446911"
                >
                  <Phone size={18} className="text-blue-300" />
                  <span className="font-semibold">+7 700 444 69 11</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-7xl border-t border-white/10 pt-8 text-center text-[10px]">
          © 2026 HorecaLink B2B Platformu. {t("home.footer.rights") || "Tum haklari saklidir."}
        </div>
      </footer>
    </main>
  );
}
