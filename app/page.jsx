// app/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { db } from "../firebase";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { Star, Grid3X3, ArrowRight, Phone } from "lucide-react";

import HeroSection from "./components/HeroSection";
import ProductCard from "./components/ProductCard";
import { useLang } from "./context/LanguageContext";

export default function Home() {
  const { t } = useLang();

  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const q = query(
          collection(db, "products"),
          where("featured", "==", true),
          orderBy("featuredOrder"),
          limit(20)
        );

        const snap = await getDocs(q);
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setFeaturedProducts(list);
      } catch (err) {
        console.error("Featured ürünler alınamadı:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  const categoryCards = useMemo(
    () => [
      {
        title: t("home.hero.category.kurumsal") || "Kurumsal Çözümler & Hijyen",
        desc:
          t("home.categories.kurumsal.desc") ||
          "Oteller ve tesisler için endüstriyel hijyen ve kurumsal sarf malzemeleri.",
        image: "/kart_kurumsal.jpg",
        href: "/categories?group=institutional",
        cta: t("home.categories.kurumsal.cta") || "Ürünleri İncele",
      },
      {
        title: t("home.hero.category.yatirim") || "Proje & Yatırım",
        desc:
          t("home.categories.yatirim.desc") ||
          "Yeni projeleriniz için komple mutfak tasarımı ve anahtar teslim kurulumlar.",
        image: "/kart_yatirim.jpg",
        href: "/categories?group=equipment",
        cta: t("home.categories.yatirim.cta") || "Çözümlere Göz At",
      },
      {
        title: t("home.hero.category.paslanmaz") || "Endüstriyel Mutfak & Sarf",
        desc:
          t("home.categories.endustriyel.desc") ||
          "Günlük operasyonlar için dayanıklı mutfak gereçleri ve paketleme ürünleri.",
        image: "/kart_paslanmaz.jpg",
        href: "/categories?group=stainless_steel",
        cta: t("home.categories.endustriyel.cta") || "Kataloğu Gör",
      },
    ],
    [t]
  );

  const topFeatured = featuredProducts.slice(0, 4);

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-gray-900">
      <HeroSection />

      {/* ANA KATEGORİLER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-[#003366] mb-8 flex items-center gap-2">
          <Grid3X3 size={22} />
          {t("home.categories.title") || "Ana Kategoriler"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {categoryCards.map((cat) => (
            <div
              key={cat.href}
              className="group relative rounded-2xl overflow-hidden aspect-[4/5] shadow-lg hover:shadow-2xl transition-all duration-500"
            >
              <Image
                src={cat.image}
                alt={cat.title}
                fill
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003366]/80 via-[#003366]/20 to-transparent" />
              <div className="absolute inset-0 p-8 flex flex-col justify-end text-white">
                <h3 className="text-2xl font-extrabold mb-4 leading-tight">{cat.title}</h3>
                <p className="text-sm text-slate-200 mb-6 line-clamp-2">{cat.desc}</p>

                <Link
                  href={cat.href}
                  className="bg-white text-[#003366] px-6 py-3 rounded-lg font-bold w-fit hover:bg-slate-100 transition-colors flex items-center gap-2"
                >
                  {cat.cta}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ÖNE ÇIKAN ÜRÜNLER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 mb-12">
        <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#003366] flex items-center gap-2">
              <Star size={22} />
              {t("home.featured.title") || "Öne Çıkan Ürünler"}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {t("home.featured.subtitle") || "Sektörün en çok tercih edilen profesyonel ekipmanları."}
            </p>
          </div>

          <Link
            href="/products"
            className="text-[#003366] font-bold text-sm flex items-center gap-1 hover:underline"
          >
            {t("home.featured.all") || "Tümünü Gör"}
            <ArrowRight size={18} />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Yükleniyor…</div>
        ) : topFeatured.length === 0 ? (
          <div className="py-12 text-center text-gray-500">Ürün bulunamadı.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {topFeatured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* WhatsApp */}
      <a
        href="https://wa.me/77004446911"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-[60] bg-[#25D366] hover:bg-[#128C7E] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="WhatsApp"
      >
        <Phone size={26} />
      </a>

      {/* FOOTER */}
      <footer className="bg-[#003366] text-slate-300 py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex flex-col mb-6">
              <Image
  src="/horecalink_logo_footer.png"
  alt="HorecaLink Logo"
  width={190}
  height={70}
  className="object-contain"
  priority
/>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-2">
                {t("home.footer.tagline") || "bir Viroo Trade online platformudur"}
              </span>
            </div>

            <p className="max-w-sm text-sm leading-relaxed">
              {t("home.footer.about") ||
                "HorecaLink.kz, otel, restoran ve kafe profesyonelleri için Kazakistan'ın B2B tedarik ve proje platformudur."}
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 text-lg">
              {t("home.footer.corporate") || "Kurumsal"}
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link className="hover:text-white transition-colors" href="/about">
                  {t("header.menu.about")}
                </Link>
              </li>
              <li>
                <Link className="hover:text-white transition-colors" href="/contact">
                  {t("header.menu.contact")}
                </Link>
              </li>
              <li>
                <Link className="hover:text-white transition-colors" href="/privacy">
                  {t("home.footer.privacy") || "Gizlilik Politikası"}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 text-lg">
              {t("home.footer.infoTitle") || "Bilgi"}
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link className="hover:text-white transition-colors" href="/shipping">
                  {t("home.footer.shipping") || "Teslimat Bilgileri"}
                </Link>
              </li>
              <li>
                <Link className="hover:text-white transition-colors" href="/payment">
                  {t("home.footer.payment") || "Ödeme Seçenekleri"}
                </Link>
              </li>
              <li className="pt-4">
                <a
                  className="flex items-center gap-2 text-white hover:text-blue-200 transition-colors"
                  href="tel:+77004446911"
                >
                  <Phone size={18} className="text-blue-300" />
                  <span className="font-semibold">+7 700 444 69 11</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-white/10 text-[10px] text-center">
          © 2026 HorecaLink B2B Platformu. {t("home.footer.rights") || "Tüm hakları saklıdır."}
        </div>
      </footer>
    </main>
  );
}