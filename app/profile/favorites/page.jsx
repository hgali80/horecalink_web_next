// app/favorites/page.jsx

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { getT } from "../../lib/i18n";

import { db } from "../../../firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import ProductCard from "../../components/ProductCard";

export default function FavoritesPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = getT(lang);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadFavorites = async () => {
      try {
        const favRef = collection(db, "users", user.uid, "favorites");
        const favSnap = await getDocs(favRef);

        const productIds = favSnap.docs.map((d) => d.id);

        const productPromises = productIds.map(async (pid) => {
          const productRef = doc(db, "products", pid);
          const snap = await getDoc(productRef);
          return snap.exists()
            ? { id: snap.id, ...snap.data() }
            : null;
        });

        const loaded = (await Promise.all(productPromises)).filter(Boolean);
        setProducts(loaded);
      } catch (err) {
        console.error("Favoriler yüklenemedi:", err);
      }

      setLoading(false);
    };

    loadFavorites();
  }, [user?.uid]);

  if (!user?.uid) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-600">
        {t("favorites.loginRequired")}
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        {t("favorites.loading")}
      </main>
    );
  }

  if (products.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        {t("favorites.empty")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-10 px-4">

      {/* BAŞLIK */}
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">
        {t("favorites.title")}
      </h1>

      {/* GRID - responsive */}
      <div
        className="
          grid 
          grid-cols-2
          sm:grid-cols-3
          md:grid-cols-4
          gap-4
        "
      >
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            currentUserId={user?.uid}
          />
        ))}
      </div>

    </main>
  );
}
