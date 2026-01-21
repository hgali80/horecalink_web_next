// app/products/[id]/page.jsx

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useParams } from "next/navigation";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { app } from "../../../firebase";
import Image from "next/image";
import Link from "next/link";
import ProductCard from "../../components/ProductCard";
import { auth } from "../../../firebase";

// ICONLAR
import { Heart, Minus, Plus } from "lucide-react";

// ✅ i18n (merkezi yapı)
import { useLang } from "../../context/LanguageContext";

export default function ProductDetailPage() {
  const { id } = useParams();
  const db = getFirestore(app);
  const storage = getStorage(app);
  const { user } = useAuth();
  const { t } = useLang();

  const [product, setProduct] = useState(null);
  const [imageUrls, setImageUrls] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ⭐ FAVORİ
  const [isFavorite, setIsFavorite] = useState(false);

  // ⭐ SEPET MİKTARI
  const [quantity, setQuantity] = useState(0);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("description");

  // 🔥 Görsel yükleme fonksiyonu
  async function loadImage(imageName) {
    try {
      return await getDownloadURL(ref(storage, `product_images/${imageName}`));
    } catch {
      return null;
    }
  }

  // 🔥 Ürünü + görselleri + benzer ürünleri getir
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);

        const docRef = doc(db, "products", id);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          setError(t("productDetail.notFound"));
          setLoading(false);
          return;
        }

        const p = { id: snap.id, ...snap.data() };
        setProduct(p);

        if (p.image_names?.length > 0) {
          const urls = await Promise.all(
            p.image_names.map((name) => loadImage(name))
          );
          setImageUrls(urls.filter(Boolean));
        }

        // BENZER ÜRÜNLER
        if (p.binding_codes?.length > 0) {
          const snapAll = await getDocs(collection(db, "products"));
          const allProducts = snapAll.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          const related = allProducts.filter(
            (x) =>
              x.id !== p.id &&
              x.binding_codes?.some((c) => p.binding_codes.includes(c))
          );

          setRelatedProducts(related);
        }
      } catch {
        setError(t("productDetail.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, t, db, storage]);

  // 🔥 ÜRÜN FAVORİDE Mİ?
  useEffect(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId || !product) return;

    const favRef = doc(db, "users", currentUserId, "favorites", product.id);

    getDoc(favRef).then((snap) => {
      if (snap.exists()) setIsFavorite(true);
    });
  }, [product, db]);

  // 🔥 ÜRÜN SEPETTE Mİ? MİKTAR KAÇ?
  useEffect(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId || !product) return;

    const cartRef = doc(db, "users", currentUserId, "basket", product.id);

    getDoc(cartRef).then((snap) => {
      if (snap.exists()) setQuantity(snap.data().quantity);
    });
  }, [product, db]);

  // 🔥 FAVORİ TOGGLE
  const toggleFavorite = async () => {
    const currentUserId = auth.currentUser?.uid;

    if (!currentUserId) {
      alert(t("productDetail.loginToFavorite"));
      return;
    }

    const favRef = doc(db, "users", currentUserId, "favorites", product.id);

    if (isFavorite) {
      await deleteDoc(favRef);
      setIsFavorite(false);
    } else {
      await setDoc(favRef, {
        createdAt: new Date(),
      });
      setIsFavorite(true);
    }
  };

  // 🔥 SEPET GÜNCELLE
  const updateBasket = async (newQty) => {
    const currentUserId = auth.currentUser?.uid;

    if (!currentUserId) return alert(t("productDetail.loginToBasket"));

    const basketRef = doc(db, "users", currentUserId, "basket", product.id);

    if (newQty <= 0) {
      await deleteDoc(basketRef);
      setQuantity(0);
      return;
    }

    await setDoc(basketRef, {
      productId: product.id,
      name: product.name_tr || product.name,
      price: product.price || 0,
      unit: product.unit || "-",
      quantity: newQty,
      image: product.image_names?.[0] || null,
      main_category: product.main_category || null,
      sub_category: product.sub_category || null,
      updatedAt: new Date(),
    });

    setQuantity(newQty);
  };

  // ---------------------------
  // DURUMLAR
  // ---------------------------
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        {t("productDetail.loading")}
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center text-red-600">
        {error}
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        {t("productDetail.notFound")}
      </main>
    );
  }

  // ---------------------------
  // TASARIM
  // ---------------------------
  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <section className="max-w-6xl mx-auto px-3 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* SOL TARAF — GÖRSEL */}
          <div className="relative">
            {/* FAVORİ KALP BUTONU */}
            <button
              onClick={toggleFavorite}
              className={`absolute right-4 top-4 z-10 p-3 rounded-full shadow 
              ${isFavorite ? "bg-red-500 text-white" : "bg-white text-gray-600"}`}
              aria-label={t("productDetail.favorite")}
            >
              <Heart size={20} />
            </button>

            <div className="flex justify-center">
              <div className="relative bg-white border rounded-xl overflow-hidden w-full max-w-[450px] aspect-square flex items-center justify-center">
                {imageUrls.length > 0 ? (
                  <Image
                    src={imageUrls[currentImageIndex]}
                    alt={product.name_tr || product.name}
                    width={450}
                    height={450}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-gray-400">{t("productDetail.noImage")}</span>
                )}
              </div>
            </div>

            {/* Thumbnail */}
            {imageUrls.length > 1 && (
              <div className="flex gap-3 mt-3 overflow-x-auto">
                {imageUrls.map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`border rounded-lg ${
                      idx === currentImageIndex ? "border-indigo-600" : "border-gray-200"
                    }`}
                    aria-label={t("productDetail.openImage", { index: idx + 1 })}
                  >
                    <Image
                      src={src}
                      width={80}
                      height={80}
                      alt={t("productDetail.thumbnailAlt")}
                      className="object-contain w-20 h-20"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Açıklama / Teknik Özellikler */}
            <div className="mt-6 bg-white rounded-xl border shadow-sm">
              <div className="border-b flex text-sm">
                <button
                  onClick={() => setActiveTab("description")}
                  className={`flex-1 py-2 ${
                    activeTab === "description"
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500"
                  }`}
                >
                  {t("productDetail.tabs.description")}
                </button>

                <button
                  onClick={() => setActiveTab("specs")}
                  className={`flex-1 py-2 ${
                    activeTab === "specs"
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500"
                  }`}
                >
                  {t("productDetail.tabs.specs")}
                </button>
              </div>

              <div className="p-4 text-sm text-gray-600">
                {activeTab === "description" && (
                  <p>{product.description || t("productDetail.noDescription")}</p>
                )}

                {activeTab === "specs" && (
                  <pre className="whitespace-pre-wrap">
                    {product.specs || t("productDetail.noSpecs")}
                  </pre>
                )}
              </div>
            </div>
          </div>

          {/* SAĞ TARAF — FİYAT + SEPET */}
          <aside>
            <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
              <h1 className="text-xl font-semibold">
                {product.name_tr || product.name}
              </h1>

              <div className="border-t pt-3">
                <p className="text-3xl font-bold text-indigo-600">
                  {product.price?.toLocaleString()} ₸
                </p>
                <p className="text-sm text-gray-500">
                  {t("productDetail.unit")}: {product.unit}
                </p>
              </div>

              {/* SEPET */}
              {quantity === 0 ? (
                <button
                  onClick={() => updateBasket(1)}
                  className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {t("productDetail.addToBasket")}
                </button>
              ) : (
                <div className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2">
                  <button
                    onClick={() => updateBasket(quantity - 1)}
                    className="text-red-600"
                    aria-label={t("productDetail.decrease")}
                  >
                    <Minus size={18} />
                  </button>

                  <span className="font-semibold">{quantity}</span>

                  <button
                    onClick={() => updateBasket(quantity + 1)}
                    className="text-indigo-600"
                    aria-label={t("productDetail.increase")}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              )}

              <Link
                href="/categories"
                className="block w-full py-3 text-center border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                {t("productDetail.backToCategories")}
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* BENZER ÜRÜNLER */}
      {relatedProducts.length > 0 && (
        <section className="max-w-6xl mx-auto px-3 mt-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t("productDetail.related")}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} currentUserId={user?.uid} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
