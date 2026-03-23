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
import { Heart, ShoppingCart, Minus, Plus, Package } from "lucide-react";
import { usePathname } from "next/navigation";
import { getT } from "../lib/i18n";

const SUPPORTED = ["tr", "ru", "kz", "en"];

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const currentUserId = user?.uid;
  const [images, setImages] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const db = getFirestore(app);
  const storage = getStorage(app);
  const pathname = usePathname();

  const [activeLang, setActiveLang] = useState("tr");

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) || [];
    const first = segments[0];
    if (SUPPORTED.includes(first)) { setActiveLang(first); return; }
    const saved = localStorage.getItem("hl_lang");
    if (saved && SUPPORTED.includes(saved)) setActiveLang(saved);
  }, [pathname]);

  const t = getT(activeLang);

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
      } catch {}
    };
    fetchImages();
  }, [product.image_names, storage]);

  useEffect(() => {
    if (!currentUserId) return;
    getDoc(doc(db, "users", currentUserId, "favorites", product.id)).then(
      (snap) => setIsFavorite(snap.exists())
    );
  }, [currentUserId, product.id, db]);

  useEffect(() => {
    if (!currentUserId) return;
    getDoc(doc(db, "users", currentUserId, "basket", product.id)).then((snap) => {
      if (snap.exists()) setQuantity(snap.data().quantity);
    });
  }, [currentUserId, product.id, db]);

  const toggleFavorite = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!currentUserId) return alert(t("productcard.loginFavorite"));
    const favRef = doc(db, "users", currentUserId, "favorites", product.id);
    if (isFavorite) { await deleteDoc(favRef); setIsFavorite(false); }
    else { await setDoc(favRef, { createdAt: new Date() }); setIsFavorite(true); }
  };

  const updateCart = async (e, newQty) => {
    e.preventDefault(); e.stopPropagation();
    if (!currentUserId) return alert(t("productcard.loginCart"));
    const cartRef = doc(db, "users", currentUserId, "basket", product.id);
    if (newQty <= 0) { await deleteDoc(cartRef); setQuantity(0); }
    else {
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
    <>
      <style>{`
        .pcard {
          background: #FFFFFF;
          border: 1.5px solid #E3E8EF;
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.25s, transform 0.2s;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .pcard:hover {
          border-color: rgba(0,180,216,0.45);
          box-shadow: 0 6px 24px rgba(10,37,64,0.11);
          transform: translateY(-2px);
        }

        .pcard__img-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: #F7F9FC;
          overflow: hidden;
          border-bottom: 1px solid #E3E8EF;
        }

        .pcard__img {
          object-fit: contain;
          padding: 10px;
          transition: transform 0.3s ease;
        }

        .pcard:hover .pcard__img { transform: scale(1.04); }

        .pcard__no-img {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #9BA8B5;
          font-size: 12px;
        }

        .pcard__fav {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1.5px solid #E3E8EF;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 2;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }

        .pcard__fav:hover { transform: scale(1.1); }
        .pcard__fav--active { background: #FFF0F0; border-color: #FFC7C7; color: #E53E3E; }

        .pcard__img-loading {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #F0F4F8 25%, #E8EDF3 50%, #F0F4F8 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .pcard__body {
          padding: 14px 14px 12px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .pcard__name {
          font-size: 13.5px;
          font-weight: 500;
          color: #0A2540;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 38px;
          margin: 0 0 10px;
          text-decoration: none;
          transition: color 0.15s;
        }

        .pcard__name:hover { color: #00B4D8; }

        .pcard__meta {
          margin-top: auto;
        }

        .pcard__price-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 4px;
        }

        .pcard__price {
          font-size: 17px;
          font-weight: 700;
          color: #0A2540;
          line-height: 1;
        }

        .pcard__no-price {
          font-size: 13px;
          color: #9BA8B5;
          font-style: italic;
        }

        .pcard__unit {
          font-size: 11.5px;
          color: #9BA8B5;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .pcard__unit::before {
          content: '';
          display: inline-block;
          width: 3px;
          height: 3px;
          background: #9BA8B5;
          border-radius: 50%;
        }

        .pcard__add-btn {
          width: 100%;
          padding: 9px 12px;
          background: linear-gradient(135deg, #0A2540, #0D3461);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: all 0.2s;
          letter-spacing: 0.2px;
        }

        .pcard__add-btn:hover {
          background: linear-gradient(135deg, #0D3461, #1149A3);
          box-shadow: 0 4px 12px rgba(10,37,64,0.25);
        }

        .pcard__qty {
          display: flex;
          align-items: center;
          background: #F7F9FC;
          border: 1.5px solid #E3E8EF;
          border-radius: 8px;
          overflow: hidden;
        }

        .pcard__qty-btn {
          flex: 0 0 36px;
          height: 36px;
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          color: #5A7184;
        }

        .pcard__qty-btn:hover { background: #E3E8EF; }
        .pcard__qty-btn--minus:hover { color: #E53E3E; }
        .pcard__qty-btn--plus:hover { color: #0DB67A; }

        .pcard__qty-num {
          flex: 1;
          text-align: center;
          font-size: 15px;
          font-weight: 700;
          color: #0A2540;
        }
      `}</style>

      <div
        className="pcard"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* IMAGE */}
        <Link href={`/products/${product.id}`}>
          <div className="pcard__img-wrap">
            {images.length > 0 ? (
              <>
                {imgLoading && <div className="pcard__img-loading" />}
                <Image
                  src={images[0]}
                  alt={product.name || ""}
                  fill
                  className="pcard__img"
                  onLoad={() => setImgLoading(false)}
                />
              </>
            ) : (
              <div className="pcard__no-img">
                <Package size={28} />
                <span>{t("productcard.noImage")}</span>
              </div>
            )}

            <button
              onClick={toggleFavorite}
              className={`pcard__fav ${isFavorite ? "pcard__fav--active" : ""}`}
            >
              <Heart size={15} fill={isFavorite ? "#E53E3E" : "none"} stroke={isFavorite ? "#E53E3E" : "#9BA8B5"} />
            </button>
          </div>
        </Link>

        {/* BODY */}
        <div className="pcard__body">
          <Link href={`/products/${product.id}`} className="pcard__name">
            {product.name}
          </Link>

          <div className="pcard__meta">
            <div className="pcard__price-row">
              {product.price ? (
                <span className="pcard__price">
                  {product.price.toLocaleString()} ₸
                </span>
              ) : (
                <span className="pcard__no-price">{t("productcard.noPrice")}</span>
              )}
            </div>

            <div className="pcard__unit">
              {t("productcard.unit")}: {product.unit || "—"}
            </div>

            {quantity === 0 ? (
              <button className="pcard__add-btn" onClick={(e) => updateCart(e, 1)}>
                <ShoppingCart size={14} />
                {t("productcard.addToCart")}
              </button>
            ) : (
              <div className="pcard__qty">
                <button
                  className="pcard__qty-btn pcard__qty-btn--minus"
                  onClick={(e) => updateCart(e, quantity - 1)}
                >
                  <Minus size={15} />
                </button>
                <span className="pcard__qty-num">{quantity}</span>
                <button
                  className="pcard__qty-btn pcard__qty-btn--plus"
                  onClick={(e) => updateCart(e, quantity + 1)}
                >
                  <Plus size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
