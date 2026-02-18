"use client";
import { useEffect, useState } from "react";
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
import Link from "next/link";

import TopBar from "./components/TopBar";
import HeroSection from "./components/HeroSection";
import UserMenu from "./components/UserMenu";

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
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;

  const encoded = encodeURIComponent(filename.trim());
  return `https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/product_images%2F${encoded}?alt=media`;
};

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [blogs, setBlogs] = useState([]);

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
        setBlogs(list);
      } catch (err) {
        console.log("Blog yüklenemedi.");
      }
    };

    loadBlogs();
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-gray-900">
      {/* TOP BAR */}
      <TopBar />

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
        <div className="flex justify-between items-center px-6 py-2">
          <Link href="/">
            <Image
              src="/horecalink_logo_app.png"
              alt="Horecalink Logo"
              width={140}
              height={55}
              className="object-contain"
              priority
            />
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <nav className="flex items-center space-x-6 text-gray-700 font-medium text-sm tracking-wide">
              <Link href="/about" className="hover:text-blue-600 transition">
                Hakkımızda
              </Link>
              <Link href="/categories" className="hover:text-blue-600 transition">
                Ürünler
              </Link>
              <Link href="/contact" className="hover:text-blue-600 transition">
                İletişim
              </Link>
            </nav>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = e.currentTarget.search.value;
                if (val.trim()) alert(`Arama yapılacak: ${val}`);
              }}
              className="flex items-center bg-gray-100 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-400 transition"
            >
              <input
                type="text"
                name="search"
                placeholder="Ürün ara..."
                className="bg-transparent outline-none text-sm px-2 w-36 md:w-48"
              />
              <button className="text-gray-500 hover:text-blue-600">🔍</button>
            </form>

            <UserMenu />
          </div>

          <button className="md:hidden text-2xl text-gray-700">☰</button>
        </div>
      </header>

      {/* HERO */}
      <HeroSection />

      {/* =====================================================
           1) NEDEN BİZİ SEÇMELİSİNİZ?
      ===================================================== */}
      <section className="py-20 bg-white">
        <h2 className="text-3xl font-bold text-center mb-12">
          Neden Bizi Seçmelisiniz?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto px-6">
          {[
            {
              title: "Hızlı Teslimat",
              icon: "🚚",
              desc: "Siparişleriniz en kısa sürede kapınıza ulaşır.",
            },
            {
              title: "Toptan Fiyat Avantajı",
              icon: "💰",
              desc: "Kurumsal müşterilere özel fiyatlandırma.",
            },
            {
              title: "Uzman Horeca Çözümleri",
              icon: "🏨",
              desc: "Profesyonel ekipman ve danışmanlık.",
            },
            {
              title: "Geniş Ürün Yelpazesi",
              icon: "📦",
              desc: "Paslanmaz, kimyasal, ambalaj ve daha fazlası.",
            },
          ].map((e, i) => (
            <div
              key={i}
              className="bg-[#F1F4F9] rounded-xl p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="text-4xl">{e.icon}</div>
              <h3 className="font-semibold text-lg mt-3 mb-2">{e.title}</h3>
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
          Çalıştığımız Markalar
        </h2>

        <div className="flex items-center justify-center gap-12 overflow-x-auto px-6 py-4">
          {brandLogos.map((logo, i) => (
            <Image
              key={i}
              src={logo}
              alt="Brand"
              width={120}
              height={80}
              className="object-contain grayscale hover:grayscale-0 transition"
            />
          ))}
        </div>
      </section>

      {/* =====================================================
           3) BLOG YAZILARI
      ===================================================== */}
      <section className="py-20 px-8">
        <h2 className="text-3xl font-bold text-center mb-10">Blog Yazıları</h2>

        {blogs.length === 0 ? (
          <p className="text-center text-gray-500">Henüz blog eklenmemiş.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {blogs.map((b) => (
              <Link
                key={b.id}
                href={`/blog/${b.id}`}
                className="bg-white rounded-xl shadow hover:shadow-lg p-4 transition"
              >
                <Image
                  src={b.image || "/placeholder.png"}
                  alt={b.title}
                  width={500}
                  height={350}
                  className="rounded-lg object-cover mb-4"
                />
                <h3 className="font-semibold text-lg">{b.title}</h3>
                <p className="text-gray-600 text-sm mt-2">{b.summary}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================
           4) ÖNE ÇIKAN ÜRÜNLER — SONSUZ DÖNGÜ SLIDER
      ===================================================== */}
      <section className="py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-10">
          Öne Çıkan Ürünler
        </h2>

        {featuredProducts.length === 0 ? (
          <p className="text-center text-gray-600">Ürünler yükleniyor...</p>
        ) : (
          <div className="overflow-hidden relative group">
            <div
              className="
                flex gap-6 py-4 
                w-[200%]
                animate-scrollLoop
                group-hover:pause-animation
              "
            >
              {featuredProducts.map((p) => {
                const img =
                  p.image_names?.length > 0
                    ? buildImageUrl(p.image_names[0])
                    : "/placeholder.png";

                return (
                  <div
                    key={p.id}
                    className="
                      bg-white rounded-xl shadow p-4
                      min-w-[200px] max-w-[200px]
                      hover:shadow-lg transition cursor-grab
                    "
                  >
                    <Image
                      src={img}
                      alt={p.name}
                      width={300}
                      height={300}
                      className="rounded-lg object-cover mb-3 h-36 w-full"
                    />

                    <h3 className="font-semibold text-sm line-clamp-2 h-10">
                      {p.name}
                    </h3>

                    <p className="text-gray-600 text-sm mb-2">
                      {p.price} ₸
                    </p>

                    <Link
                      href={`/products/${p.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Detaylar →
                    </Link>
                  </div>
                );
              })}

              {/* Sonsuz döngü için ikinci set */}
              {featuredProducts.map((p) => {
                const img =
                  p.image_names?.length > 0
                    ? buildImageUrl(p.image_names[0])
                    : "/placeholder.png";

                return (
                  <div
                    key={"clone-" + p.id}
                    className="
                      bg-white rounded-xl shadow p-4
                      min-w-[200px] max-w-[200px]
                      hover:shadow-lg transition cursor-grab
                    "
                  >
                    <Image
                      src={img}
                      alt={p.name}
                      width={300}
                      height={300}
                      className="rounded-lg object-cover mb-3 h-36 w-full"
                    />

                    <h3 className="font-semibold text-sm line-clamp-2 h-10">
                      {p.name}
                    </h3>

                    <p className="text-gray-600 text-sm mb-2">
                      {p.price} ₸
                    </p>

                    <Link
                      href={`/products/${p.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Detaylar →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-400 text-white py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">
          İşletmeniz için en uygun fiyat teklifini alın.
        </h2>
        <Link
          href="/contact"
          className="bg-white text-blue-700 font-semibold px-8 py-3 rounded-lg hover:bg-gray-100 transition"
        >
          Teklif Talep Et
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#003366] text-white py-16 px-8 mt-16">
        <div className="grid md:grid-cols-3 gap-10">
          <div>
            <Image
              src="/horecalink_logo_app.png"
              alt="Horecalink Logo"
              width={180}
              height={100}
              className="object-contain"
            />
            <p className="mt-4 text-sm text-gray-300">
              Horecalink — restoran, otel ve endüstriyel mutfaklar için
              yenilikçi çözümler sunar.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Bilgiler</h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <Link href="/about">Hakkımızda</Link>
              </li>
              <li>
                <Link href="/contact">İletişim</Link>
              </li>
              <li>
                <Link href="/privacy">Gizlilik Politikası</Link>
              </li>
              <li>
                <Link href="/shipping">Kargolama ve Teslimat</Link>
              </li>
              <li>
                <Link href="/payment">Ödeme Koşulları</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Adres</h3>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              ТОО «Viroo Trade» <br />
              г. Алматы, индекс 050050 <br />
              Жetысуский район, ул. Черноморская дом 12 <br />
              info@horecalink.kz <br />
              +7 700 444 6 911
            </p>

            <iframe
              src="https://www.google.com/maps?q=43.271083,76.918236&z=16&output=embed"
              className="w-full h-40 rounded-lg border border-gray-400"
              loading="lazy"
            ></iframe>
          </div>
        </div>

        <div className="border-t border-gray-500 mt-10 pt-4 text-center text-sm text-gray-400">
          © 2025 Horecalink — Tüm Hakları Saklıdır.
        </div>
      </footer>
    </main>
  );
}
