// app/components/ProductCard.jsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Image from "next/image";
import Link from "next/link";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { app } from "../../firebase";
import {
  Heart,
  ShoppingCart,
  Minus,
  Plus,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { getT } from "../lib/i18n";

const SUPPORTED = ["tr", "ru", "kz", "en"];

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const currentUserId = user?.uid;
  const [images, setImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(0);

  const db = getFirestore(app);
  const storage = getStorage(app);
  const pathname = usePathname();

  const [activeLang, setActiveLang] = useState("tr");

  // 🔹 Dil tespiti
  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) || [];
    const first = segments[0];

    if (SUPPORTED.includes(first)) {
      setActiveLang(first);
      return;
    }

    const saved = localStorage.getItem("hl_lang");
    if (saved && SUPPORTED.includes(saved)) {
      setActiveLang(saved);
    }
  }, [pathname]);

  const t = getT(activeLang);

  // 🔥 Görselleri çek
  useEffect(() => {
    const fetchImages = async () => {
      try {
        if (product.image_names?.length > 0) {
          const urls = await Promise.all(
            product.image_names.map((img) =>
              getDownloadURL(ref(storage, `product_images/${img}`))
            )
          );
          setImages(urls);
        }
      } catch (error) {
        console.error("Görseller yüklenemedi:", error);
      }
    };

    fetchImages();
  }, [product.image_names, storage]);

  // 🔥 Favori kontrolü
  useEffect(() => {
    if (!currentUserId) return;
    const favRef = doc(db, "users", currentUserId, "favorites", product.id);

    getDoc(favRef).then((snap) => {
      setIsFavorite(snap.exists());
    });
  }, [currentUserId, product.id, db]);

  // 🔥 Sepetteki miktarı kontrol et
  useEffect(() => {
    if (!currentUserId) return;
    const cartRef = doc(db, "users", currentUserId, "basket", product.id);

    getDoc(cartRef).then((snap) => {
      if (snap.exists()) {
        setQuantity(snap.data().quantity);
      }
    });
  }, [currentUserId, product.id, db]);

  // 🔥 Favori toggle
  const toggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId) return alert(t("productcard.loginFavorite"));

    const favRef = doc(db, "users", currentUserId, "favorites", product.id);

    if (isFavorite) {
      await deleteDoc(favRef);
      setIsFavorite(false);
    } else {
      await setDoc(favRef, { createdAt: new Date() });
      setIsFavorite(true);
    }
  };

  // 🔥 Sepet güncelleme
  const updateCart = async (e, newQty) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId) return alert(t("productcard.loginCart"));

    const cartRef = doc(db, "users", currentUserId, "basket", product.id);

    if (newQty <= 0) {
      await deleteDoc(cartRef);
      setQuantity(0);
    } else {
      await setDoc(cartRef, {
        productId: product.id,
        name: product.name_tr || product.name,
        price: product.price || 0,
        unit: product.unit || "-",
        quantity: newQty,
        image: product.image_names?.[0] || null,
        main_category: product.main_category || null,
        sub_category: product.sub_category || null,
        addedAt: new Date(),
      });
      setQuantity(newQty);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition">
      <Link href={`/products/${product.id}`}>
        <div className="relative w-full h-52 overflow-hidden">
          {images.length > 0 ? (
            <Image
              src={images[currentImage]}
              alt={product.name}
              width={300}
              height={300}
              className="object-contain w-full h-52"
            />
          ) : (
            <div className="w-full h-52 bg-gray-100 flex items-center justify-center">
              {t("productcard.noImage")}
            </div>
          )}

          <button
            onClick={toggleFavorite}
            className={`absolute top-2 right-2 p-2 rounded-full shadow 
              ${isFavorite ? "bg-red-500 text-white" : "bg-white text-gray-600"}`}
          >
            <Heart size={18} />
          </button>
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/products/${product.id}`}>
          <h3 className="text-gray-800 font-medium text-sm line-clamp-2 h-10">
            {product.name}
          </h3>

          <p className="text-gray-800 text-lg font-semibold mt-2">
            {product.price
              ? `${product.price.toLocaleString()} ₸`
              : t("productcard.noPrice")}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {t("productcard.unit")}: {product.unit || "-"}
          </p>
        </Link>

        <div className="mt-3">
          {quantity === 0 ? (
            <button
              onClick={(e) => updateCart(e, 1)}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700"
            >
              <ShoppingCart size={16} />
              {t("productcard.addToCart")}
            </button>
          ) : (
            <div className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2">
              <button
                onClick={(e) => updateCart(e, quantity - 1)}
                className="text-red-600"
              >
                <Minus size={18} />
              </button>

              <span className="font-semibold">{quantity}</span>

              <button
                onClick={(e) => updateCart(e, quantity + 1)}
                className="text-emerald-600"
              >
                <Plus size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
