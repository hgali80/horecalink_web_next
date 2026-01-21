// app/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import Image from "next/image";
import HeroSection from "./components/HeroSection";
import { useLang } from "./context/LanguageContext";

// =========================
// MARKA LOGOLARI
// =========================
const brandLogos = [
  "/brands/logo1.png",
  "/brands/logo2.png",
  "/brands/logo3.png",
  "/brands/logo4.png",
];

// =========================
// ÜRÜN GÖRSELİ URL OLUŞTURMA
// =========================
const buildImageUrl = (filename) => {
  if (!filename) return "/placeholder.png";
  if (filename.startsWith("http")) return filename;

  const encoded = encodeURIComponent(filename.trim());
  return `https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/product_images%2F${encoded}?alt=media`;
};

export default function Home() {
  const { t } = useLang();

  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ============================
  // 1) ÖNE ÇIKAN ÜRÜNLERİ ÇEK
  // ============================
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
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setFeaturedProducts(list);
      } catch (err) {
        console.error("Featured ürünler alınamadı:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  // ========================================
  // 2) BLOG YAZILARI
  // ========================================
  useEffect(() => {
    const loadBlogs = async () => {
      try {
        const snap = await getDocs(collection(db, "blogs"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBlogs(list.slice(0, 6));
      } catch (err) {
        console.log("Blog yüklenemedi.");
      }
    };

    loadBlogs();
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-gray-900">
      {/* HERO */}
      <HeroSection />

      {/* =====================================================
           1) NEDEN BİZİ SEÇMELİSİNİZ?
      ===================================================== */}
      <section className="py-20 bg-white">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t("home.why.title")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto px-6">
          {[
            {
              title: t("home.why.items.fast.title"),
              icon: "🚚",
              desc: t("home.why.items.fast.desc"),
            },
            {
              title: t("home.why.items.price.title"),
              icon: "💰",
              desc: t("home.why.items.price.desc"),
            },
            {
              title: t("home.why.items.expert.title"),
              icon: "🏨",
              desc: t("home.why.items.expert.desc"),
            },
            {
              title: t("home.why.items.range.title"),
              icon: "📦",
              desc: t("home.why.items.range.desc"),
            },
          ].map((e, i) => (
            <div
              key={i}
              className="bg-[#F1F4F9] rounded-xl p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="text-4xl mb-4">{e.icon}</div>
              <h3 className="font-semibold text-lg mb-3">{e.title}</h3>
              <p className="text-sm text-gray-600">{e.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
           2) MARKALAR SLIDERI
      ===================================================== */}
      <section className="py-16 bg-[#F8FAFC]">
        <h2 className="text-3xl font-bold text-center mb-10">
          {t("home.brands.title")}
        </h2>

        <div className="flex items-center justify-center gap-12 overflow-x-auto px-6 py-4 no-scrollbar">
          {brandLogos.map((logo, i) => (
            <div key={i} className="flex-shrink-0">
              <Image
                src={logo}
                alt={t("home.brands.alt")}
                width={120}
                height={80}
                className="object-contain grayscale hover:grayscale-0 transition duration-300"
              />
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
           3) BLOG YAZILARI
      ===================================================== */}
      {blogs.length > 0 && (
        <section className="py-20 px-8 max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">
            {t("home.blog.title")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {blogs.map((b) => (
              <Link
                key={b.id}
                href={`/blog/${b.id}`}
                className="bg-white rounded-xl shadow hover:shadow-lg p-4 transition hover:translate-y-[-4px] block"
              >
                <div className="relative h-48 w-full mb-4 overflow-hidden rounded-lg">
                  <Image
                    src={b.image || "/placeholder.png"}
                    alt={b.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                  {b.title}
                </h3>
                <p className="text-gray-600 text-sm line-clamp-3">
                  {b.summary}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-400 text-white py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">
          {t("home.cta.title")}
        </h2>
        <Link
          href="/contact"
          className="bg-white text-blue-700 font-semibold px-8 py-3 rounded-lg hover:bg-gray-100 transition inline-block"
        >
          {t("home.cta.button")}
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#003366] text-white py-16 px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
          <div>
            <Image
              src="/horecalink_logoapp.png"
              alt={t("header.alt.logo")}
              width={180}
              height={100}
              className="object-contain"
            />
            <p className="mt-4 text-sm text-gray-300">
              {t("home.footer.about")}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">
              {t("home.footer.infoTitle")}
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <Link href="/about" className="hover:text-white">
                  {t("header.menu.about")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  {t("header.menu.contact")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  {t("home.footer.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-white">
                  {t("home.footer.shipping")}
                </Link>
              </li>
              <li>
                <Link href="/payment" className="hover:text-white">
                  {t("home.footer.payment")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">
              {t("home.footer.addressTitle")}
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              ТОО «Viroo Trade» <br />
              г. Алматы, индекс 050050 <br />
              Жетісуский район, ул. Черноморская дом 12 <br />
              info@horecalink.kz <br />
              +7 700 444 6 911
            </p>
          </div>
        </div>

        <div className="border-t border-gray-500 mt-10 pt-4 text-center text-sm text-gray-400 max-w-7xl mx-auto">
          © 2025 Horecalink — {t("home.footer.rights")}
        </div>
      </footer>

      <style jsx>{`
        @keyframes scrollLoop {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scrollLoop {
          animation: scrollLoop 30s linear infinite;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </main>
  );
}
