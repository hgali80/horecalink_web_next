// app/products/[id]/page.jsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { app } from "../../../firebase";
import { useAuth } from "../../context/AuthContext";
import { usePathname } from "next/navigation";
import { getT } from "../../lib/i18n";
import {
  Heart,
  ShoppingCart,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  Package,
  Tag,
  Layers,
  FileText,
  Wrench,
  ArrowLeft,
  CheckCircle,
  Share2,
  ZoomIn,
} from "lucide-react";

const SUPPORTED = ["tr", "ru", "kz", "en"];

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const currentUserId = user?.uid;

  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("description");
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedImages, setRelatedImages] = useState({});
  const [imgLoading, setImgLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const [activeLang, setActiveLang] = useState("tr");

  const db = getFirestore(app);
  const storage = getStorage(app);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) || [];
    const first = segments[0];
    if (SUPPORTED.includes(first)) { setActiveLang(first); return; }
    const saved = typeof window !== "undefined" && localStorage.getItem("hl_lang");
    if (saved && SUPPORTED.includes(saved)) setActiveLang(saved);
  }, [pathname]);

  const t = getT(activeLang);

  // Fetch product
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDoc(doc(db, "products", id))
      .then((snap) => {
        if (!snap.exists()) { setError(t("productDetail.notFound")); return; }
        setProduct({ id: snap.id, ...snap.data() });
      })
      .catch(() => setError(t("productDetail.loadError")))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch images
  useEffect(() => {
    if (!product?.image_names?.length) return;
    Promise.all(
      product.image_names.map((img) =>
        getDownloadURL(ref(storage, `product_images/${img}`))
      )
    )
      .then(setImages)
      .catch(() => {});
  }, [product]);

  // Favorite & cart state
  useEffect(() => {
    if (!currentUserId || !id) return;
    getDoc(doc(db, "users", currentUserId, "favorites", id)).then((snap) =>
      setIsFavorite(snap.exists())
    );
    getDoc(doc(db, "users", currentUserId, "basket", id)).then((snap) => {
      if (snap.exists()) setQuantity(snap.data().quantity);
    });
  }, [currentUserId, id]);

  // Related products
  useEffect(() => {
    if (!product?.main_category) return;
    const q = query(
      collection(db, "products"),
      where("main_category", "==", product.main_category),
      limit(5)
    );
    getDocs(q).then(async (snap) => {
      const items = snap.docs
        .filter((d) => d.id !== id)
        .slice(0, 4)
        .map((d) => ({ id: d.id, ...d.data() }));
      setRelatedProducts(items);

      // fetch first image for each
      const imgMap = {};
      await Promise.all(
        items.map(async (item) => {
          if (item.image_names?.[0]) {
            try {
              imgMap[item.id] = await getDownloadURL(
                ref(storage, `product_images/${item.image_names[0]}`)
              );
            } catch {}
          }
        })
      );
      setRelatedImages(imgMap);
    });
  }, [product]);

  const toggleFavorite = async (e) => {
    e?.preventDefault();
    if (!currentUserId) return alert(t("productDetail.loginToFavorite"));
    const favRef = doc(db, "users", currentUserId, "favorites", id);
    if (isFavorite) { await deleteDoc(favRef); setIsFavorite(false); }
    else { await setDoc(favRef, { createdAt: new Date() }); setIsFavorite(true); }
  };

  const updateCart = async (newQty) => {
    if (!currentUserId) return alert(t("productDetail.loginToBasket"));
    const cartRef = doc(db, "users", currentUserId, "basket", id);
    if (newQty <= 0) {
      await deleteDoc(cartRef);
      setQuantity(0);
    } else {
      await setDoc(cartRef, {
        productId: id,
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

  const handleAddToCart = async () => {
    await updateCart(1);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const prevImg = () => setActiveImg((p) => (p - 1 + images.length) % images.length);
  const nextImg = () => setActiveImg((p) => (p + 1) % images.length);

  // Keyboard lightbox
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") prevImg();
      if (e.key === "ArrowRight") nextImg();
      if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, images.length]);

  // ─── LOADING ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{skeletonCSS}</style>
        <div className="pd-skeleton">
          <div className="pd-skeleton__img" />
          <div className="pd-skeleton__body">
            <div className="pd-skeleton__line pd-skeleton__line--lg" />
            <div className="pd-skeleton__line pd-skeleton__line--md" />
            <div className="pd-skeleton__line pd-skeleton__line--sm" />
            <div className="pd-skeleton__line pd-skeleton__line--btn" />
          </div>
        </div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <style>{mainCSS}</style>
        <div className="pd-error">
          <Package size={48} strokeWidth={1} />
          <h2>{error || t("productDetail.notFound")}</h2>
          <button className="pd-btn-primary" onClick={() => router.back()}>
            <ArrowLeft size={16} /> {t("productDetail.backToCategories")}
          </button>
        </div>
      </>
    );
  }

  const productName = product[`name_${activeLang}`] || product.name || "";
  const description = product[`description_${activeLang}`] || product.description || "";
  const specs = product[`specs_${activeLang}`] || product.specs || "";

  return (
    <>
      <style>{mainCSS}</style>

      {/* ── LIGHTBOX ─────────────────────────────────────── */}
      {lightbox && (
        <div className="pd-lightbox" onClick={() => setLightbox(false)}>
          <div className="pd-lightbox__inner" onClick={(e) => e.stopPropagation()}>
            <button className="pd-lightbox__close" onClick={() => setLightbox(false)}>✕</button>
            {images.length > 1 && (
              <>
                <button className="pd-lightbox__nav pd-lightbox__nav--prev" onClick={prevImg}>
                  <ChevronLeft size={28} />
                </button>
                <button className="pd-lightbox__nav pd-lightbox__nav--next" onClick={nextImg}>
                  <ChevronRight size={28} />
                </button>
              </>
            )}
            <div className="pd-lightbox__img-wrap">
              <Image
                src={images[activeImg]}
                alt={productName}
                fill
                className="pd-lightbox__img"
              />
            </div>
            {images.length > 1 && (
              <div className="pd-lightbox__counter">
                {activeImg + 1} / {images.length}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pd-page">
        {/* ── BREADCRUMB ───────────────────────────────── */}
        <nav className="pd-breadcrumb">
          <Link href="/" className="pd-breadcrumb__item">{t("breadcrumb.home")}</Link>
          <span className="pd-breadcrumb__sep">›</span>
          <Link href="/categories" className="pd-breadcrumb__item">{t("header.menu.products")}</Link>
          {product.main_category && (
            <>
              <span className="pd-breadcrumb__sep">›</span>
              <span className="pd-breadcrumb__item pd-breadcrumb__item--current">
                {t(`category.main.${product.main_category}`) || product.main_category}
              </span>
            </>
          )}
          <span className="pd-breadcrumb__sep">›</span>
          <span className="pd-breadcrumb__item pd-breadcrumb__item--current">{productName}</span>
        </nav>

        {/* ── MAIN GRID ────────────────────────────────── */}
        <div className="pd-main">

          {/* LEFT: Gallery */}
          <div className="pd-gallery">
            {/* Main Image */}
            <div className="pd-gallery__main" onClick={() => images.length > 0 && setLightbox(true)}>
              {images.length > 0 ? (
                <>
                  {imgLoading && <div className="pd-gallery__shimmer" />}
                  <Image
                    src={images[activeImg]}
                    alt={productName}
                    fill
                    className="pd-gallery__img"
                    onLoad={() => setImgLoading(false)}
                    priority
                  />
                  <div className="pd-gallery__zoom-hint">
                    <ZoomIn size={18} />
                  </div>
                  {images.length > 1 && (
                    <>
                      <button className="pd-gallery__arrow pd-gallery__arrow--left" onClick={(e) => { e.stopPropagation(); prevImg(); }}>
                        <ChevronLeft size={20} />
                      </button>
                      <button className="pd-gallery__arrow pd-gallery__arrow--right" onClick={(e) => { e.stopPropagation(); nextImg(); }}>
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="pd-gallery__empty">
                  <Package size={56} strokeWidth={1} />
                  <span>{t("productDetail.noImage")}</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="pd-gallery__thumbs">
                {images.map((url, i) => (
                  <button
                    key={i}
                    className={`pd-gallery__thumb ${i === activeImg ? "pd-gallery__thumb--active" : ""}`}
                    onClick={() => setActiveImg(i)}
                    aria-label={t("productDetail.thumbnailAlt")}
                  >
                    <Image src={url} alt="" fill className="pd-gallery__thumb-img" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Info */}
          <div className="pd-info">
            {/* Category badge */}
            {product.main_category && (
              <div className="pd-info__badge">
                <Layers size={13} />
                {t(`category.main.${product.main_category}`) || product.main_category}
                {product.sub_category && (
                  <> › {t(`category.sub.${product.sub_category}`) || product.sub_category}</>
                )}
              </div>
            )}

            {/* Name */}
            <h1 className="pd-info__name">{productName}</h1>

            {/* Stock Code */}
            {product.stock_code && (
              <div className="pd-info__stock">
                <Tag size={13} />
                {t("productDetail.stockCode")}: <strong>{product.stock_code}</strong>
              </div>
            )}

            {/* Divider */}
            <div className="pd-info__divider" />

            {/* Price */}
            <div className="pd-info__price-block">
              {product.price ? (
                <>
                  <span className="pd-info__price">
                    {product.price.toLocaleString()} ₸
                  </span>
                  {product.unit && (
                    <span className="pd-info__price-unit">/ {product.unit}</span>
                  )}
                </>
              ) : (
                <span className="pd-info__no-price">{t("productDetail.noPrice") || t("productcard.noPrice")}</span>
              )}
            </div>

            {/* Unit info */}
            {product.unit && (
              <div className="pd-info__unit-row">
                <span className="pd-info__unit-label">{t("productDetail.unit")}:</span>
                <span className="pd-info__unit-val">{product.unit}</span>
              </div>
            )}

            <div className="pd-info__divider" />

            {/* Cart Actions */}
            <div className="pd-info__actions">
              {quantity === 0 ? (
                <button
                  className={`pd-btn-cart ${addedToCart ? "pd-btn-cart--added" : ""}`}
                  onClick={handleAddToCart}
                >
                  {addedToCart ? (
                    <><CheckCircle size={18} /> {activeLang === "tr" ? "Sepete Eklendi!" : activeLang === "ru" ? "Добавлено!" : "Added!"}</>
                  ) : (
                    <><ShoppingCart size={18} /> {t("productDetail.addToBasket")}</>
                  )}
                </button>
              ) : (
                <div className="pd-info__qty">
                  <button className="pd-info__qty-btn pd-info__qty-btn--minus" onClick={() => updateCart(quantity - 1)}>
                    <Minus size={18} />
                  </button>
                  <span className="pd-info__qty-num">{quantity}</span>
                  <button className="pd-info__qty-btn pd-info__qty-btn--plus" onClick={() => updateCart(quantity + 1)}>
                    <Plus size={18} />
                  </button>
                </div>
              )}

              <button
                className={`pd-btn-fav ${isFavorite ? "pd-btn-fav--active" : ""}`}
                onClick={toggleFavorite}
                aria-label={t("productDetail.favorite")}
                title={t("productDetail.favorite")}
              >
                <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
              </button>

              <button
                className="pd-btn-share"
                onClick={() => {
                  if (navigator.share) navigator.share({ title: productName, url: window.location.href });
                  else navigator.clipboard.writeText(window.location.href);
                }}
                aria-label="Paylaş"
                title="Paylaş"
              >
                <Share2 size={20} />
              </button>
            </div>

            {/* Trust badges */}
            <div className="pd-info__trust">
              <span className="pd-info__trust-item">✓ {activeLang === "tr" ? "Hızlı Teslimat" : activeLang === "ru" ? "Быстрая доставка" : "Fast Delivery"}</span>
              <span className="pd-info__trust-item">✓ {activeLang === "tr" ? "Güvenli Ödeme" : activeLang === "ru" ? "Безопасная оплата" : "Secure Payment"}</span>
              <span className="pd-info__trust-item">✓ {activeLang === "tr" ? "B2B Destek" : activeLang === "ru" ? "B2B Поддержка" : "B2B Support"}</span>
            </div>
          </div>
        </div>

        {/* ── TABS ─────────────────────────────────────── */}
        <div className="pd-tabs">
          <div className="pd-tabs__nav">
            <button
              className={`pd-tabs__btn ${activeTab === "description" ? "pd-tabs__btn--active" : ""}`}
              onClick={() => setActiveTab("description")}
            >
              <FileText size={16} />
              {t("productDetail.tabs.description")}
            </button>
            <button
              className={`pd-tabs__btn ${activeTab === "specs" ? "pd-tabs__btn--active" : ""}`}
              onClick={() => setActiveTab("specs")}
            >
              <Wrench size={16} />
              {t("productDetail.tabs.specs")}
            </button>
          </div>

          <div className="pd-tabs__panel">
            {activeTab === "description" ? (
              <div className="pd-tabs__content">
                {description
                  ? description.split("\n").map((line, i) => <p key={i}>{line}</p>)
                  : <p className="pd-tabs__empty">{t("productDetail.noDescription")}</p>
                }
              </div>
            ) : (
              <div className="pd-tabs__content">
                {specs ? (
                  <div className="pd-specs">
                    {specs.split("\n").filter(Boolean).map((line, i) => {
                      const [key, ...rest] = line.split(":");
                      return rest.length > 0 ? (
                        <div key={i} className="pd-specs__row">
                          <span className="pd-specs__key">{key.trim()}</span>
                          <span className="pd-specs__val">{rest.join(":").trim()}</span>
                        </div>
                      ) : (
                        <div key={i} className="pd-specs__row pd-specs__row--full">
                          <span>{line}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="pd-tabs__empty">{t("productDetail.noSpecs")}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RELATED PRODUCTS ─────────────────────────── */}
        {relatedProducts.length > 0 && (
          <div className="pd-related">
            <h2 className="pd-related__title">{t("productDetail.related")}</h2>
            <div className="pd-related__grid">
              {relatedProducts.map((rp) => {
                const rpName = rp[`name_${activeLang}`] || rp.name || "";
                return (
                  <Link key={rp.id} href={`/products/${rp.id}`} className="pd-rcard">
                    <div className="pd-rcard__img-wrap">
                      {relatedImages[rp.id] ? (
                        <Image
                          src={relatedImages[rp.id]}
                          alt={rpName}
                          fill
                          className="pd-rcard__img"
                        />
                      ) : (
                        <div className="pd-rcard__no-img">
                          <Package size={28} strokeWidth={1} />
                        </div>
                      )}
                    </div>
                    <div className="pd-rcard__body">
                      <p className="pd-rcard__name">{rpName}</p>
                      <p className="pd-rcard__price">
                        {rp.price ? `${rp.price.toLocaleString()} ₸` : t("productcard.noPrice")}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── BACK BUTTON ──────────────────────────────── */}
        <div className="pd-back">
          <button className="pd-btn-back" onClick={() => router.back()}>
            <ArrowLeft size={16} />
            {t("productDetail.backToCategories")}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const mainCSS = `
  .pd-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 20px 64px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #0A2540;
  }

  /* BREADCRUMB */
  .pd-breadcrumb {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 12.5px;
    color: #8A9BB0;
    margin-bottom: 28px;
  }
  .pd-breadcrumb__item {
    color: #8A9BB0;
    text-decoration: none;
    transition: color 0.15s;
  }
  .pd-breadcrumb__item:hover { color: #0077CC; }
  .pd-breadcrumb__item--current { color: #0A2540; font-weight: 500; }
  .pd-breadcrumb__sep { color: #C5D0DC; font-size: 14px; }

  /* MAIN GRID */
  .pd-main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    align-items: start;
    margin-bottom: 48px;
  }
  @media (max-width: 768px) {
    .pd-main { grid-template-columns: 1fr; gap: 28px; }
  }

  /* GALLERY */
  .pd-gallery__main {
    position: relative;
    width: 100%;
    aspect-ratio: 1/1;
    background: #F5F7FA;
    border-radius: 16px;
    overflow: hidden;
    cursor: zoom-in;
    border: 1.5px solid #E8EDF3;
  }
  .pd-gallery__img {
    object-fit: contain;
    padding: 20px;
    transition: transform 0.4s ease;
  }
  .pd-gallery__main:hover .pd-gallery__img { transform: scale(1.04); }
  .pd-gallery__shimmer {
    position: absolute; inset: 0;
    background: linear-gradient(90deg, #EEF1F6 25%, #E4E8EF 50%, #EEF1F6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 16px;
    z-index: 1;
  }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .pd-gallery__zoom-hint {
    position: absolute;
    top: 12px; right: 12px;
    background: rgba(255,255,255,0.9);
    border: 1px solid #E3E8EF;
    border-radius: 8px;
    padding: 6px 8px;
    color: #7A8FA6;
    display: flex; align-items: center;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .pd-gallery__main:hover .pd-gallery__zoom-hint { opacity: 1; }
  .pd-gallery__empty {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px; color: #A0AEC0;
    font-size: 13px;
  }
  .pd-gallery__arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    background: rgba(255,255,255,0.92);
    border: 1px solid #E3E8EF;
    border-radius: 50%;
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 3;
    transition: all 0.2s; color: #0A2540;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .pd-gallery__arrow:hover { background: #0A2540; color: white; }
  .pd-gallery__arrow--left { left: 12px; }
  .pd-gallery__arrow--right { right: 12px; }
  .pd-gallery__thumbs {
    display: flex; gap: 10px;
    margin-top: 12px; flex-wrap: wrap;
  }
  .pd-gallery__thumb {
    position: relative;
    width: 68px; height: 68px;
    border-radius: 10px;
    border: 2px solid #E3E8EF;
    overflow: hidden; cursor: pointer;
    background: #F5F7FA;
    transition: border-color 0.2s, transform 0.15s;
    flex-shrink: 0;
  }
  .pd-gallery__thumb:hover { transform: translateY(-2px); border-color: #0077CC; }
  .pd-gallery__thumb--active { border-color: #0A2540; box-shadow: 0 0 0 3px rgba(10,37,64,0.12); }
  .pd-gallery__thumb-img { object-fit: contain; padding: 4px; }

  /* INFO */
  .pd-info__badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: #EBF4FF; color: #0069CC;
    font-size: 12px; font-weight: 600;
    padding: 5px 12px; border-radius: 20px;
    margin-bottom: 16px;
    letter-spacing: 0.2px;
  }
  .pd-info__name {
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 700; line-height: 1.3;
    color: #0A2540; margin: 0 0 12px;
  }
  .pd-info__stock {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; color: #7A8FA6;
    background: #F5F7FA; padding: 5px 12px;
    border-radius: 6px; margin-bottom: 4px;
  }
  .pd-info__divider {
    height: 1px; background: #E8EDF3;
    margin: 20px 0;
  }
  .pd-info__price-block {
    display: flex; align-items: baseline; gap: 8px;
    margin-bottom: 8px;
  }
  .pd-info__price {
    font-size: 32px; font-weight: 800;
    color: #0A2540; line-height: 1;
    letter-spacing: -0.5px;
  }
  .pd-info__price-unit {
    font-size: 15px; color: #8A9BB0; font-weight: 500;
  }
  .pd-info__no-price {
    font-size: 16px; color: #A0AEC0; font-style: italic;
  }
  .pd-info__unit-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 13.5px; color: #5A7184; margin-bottom: 4px;
  }
  .pd-info__unit-label { color: #A0AEC0; }
  .pd-info__unit-val { font-weight: 600; color: #0A2540; }

  /* ACTIONS */
  .pd-info__actions {
    display: flex; gap: 12px; align-items: center;
    flex-wrap: wrap;
  }
  .pd-btn-cart {
    flex: 1; min-width: 180px;
    display: flex; align-items: center; justify-content: center; gap: 9px;
    background: linear-gradient(135deg, #0A2540 0%, #0D3461 100%);
    color: white; border: none; border-radius: 12px;
    padding: 14px 24px; font-size: 15px; font-weight: 700;
    cursor: pointer; transition: all 0.25s;
    letter-spacing: 0.2px;
    box-shadow: 0 4px 16px rgba(10,37,64,0.2);
  }
  .pd-btn-cart:hover {
    background: linear-gradient(135deg, #0D3461 0%, #1149A3 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(10,37,64,0.28);
  }
  .pd-btn-cart--added {
    background: linear-gradient(135deg, #0DB67A 0%, #059669 100%) !important;
    box-shadow: 0 4px 16px rgba(13,182,122,0.3) !important;
  }
  .pd-info__qty {
    flex: 1; min-width: 160px;
    display: flex; align-items: center;
    background: #F5F7FA; border: 2px solid #E3E8EF;
    border-radius: 12px; overflow: hidden;
  }
  .pd-info__qty-btn {
    flex: 0 0 48px; height: 50px;
    border: none; background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #5A7184; transition: all 0.15s; font-size: 18px;
  }
  .pd-info__qty-btn:hover { background: #E3E8EF; }
  .pd-info__qty-btn--minus:hover { color: #E53E3E; }
  .pd-info__qty-btn--plus:hover { color: #0DB67A; }
  .pd-info__qty-num {
    flex: 1; text-align: center;
    font-size: 18px; font-weight: 800; color: #0A2540;
  }
  .pd-btn-fav {
    width: 50px; height: 50px;
    border-radius: 12px;
    border: 2px solid #E3E8EF;
    background: white; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #A0AEC0; transition: all 0.2s;
    flex-shrink: 0;
  }
  .pd-btn-fav:hover { border-color: #FFC7C7; color: #E53E3E; background: #FFF0F0; }
  .pd-btn-fav--active { border-color: #FFC7C7; color: #E53E3E; background: #FFF0F0; }
  .pd-btn-share {
    width: 50px; height: 50px;
    border-radius: 12px;
    border: 2px solid #E3E8EF;
    background: white; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #A0AEC0; transition: all 0.2s;
    flex-shrink: 0;
  }
  .pd-btn-share:hover { border-color: #B3D4FF; color: #0069CC; background: #EBF4FF; }

  /* Trust badges */
  .pd-info__trust {
    display: flex; flex-wrap: wrap; gap: 10px;
    margin-top: 20px;
  }
  .pd-info__trust-item {
    font-size: 12px; color: #5A7184;
    background: #F5F7FA; border: 1px solid #E3E8EF;
    padding: 5px 12px; border-radius: 20px;
    font-weight: 500;
  }

  /* TABS */
  .pd-tabs {
    background: white;
    border: 1.5px solid #E8EDF3;
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 48px;
  }
  .pd-tabs__nav {
    display: flex;
    border-bottom: 1.5px solid #E8EDF3;
    background: #F8FAFC;
  }
  .pd-tabs__btn {
    display: flex; align-items: center; gap: 8px;
    padding: 16px 28px;
    border: none; background: none;
    font-size: 14px; font-weight: 600;
    color: #7A8FA6; cursor: pointer;
    transition: all 0.2s;
    border-bottom: 3px solid transparent;
    margin-bottom: -1.5px;
  }
  .pd-tabs__btn:hover { color: #0A2540; }
  .pd-tabs__btn--active {
    color: #0A2540;
    border-bottom-color: #0A2540;
    background: white;
  }
  .pd-tabs__panel { padding: 28px 32px; }
  @media (max-width: 600px) { .pd-tabs__panel { padding: 20px 18px; } }
  .pd-tabs__content { line-height: 1.75; color: #3D5166; font-size: 14.5px; }
  .pd-tabs__content p { margin: 0 0 12px; }
  .pd-tabs__empty { color: #A0AEC0; font-style: italic; font-size: 14px; }

  /* SPECS TABLE */
  .pd-specs { border: 1px solid #E8EDF3; border-radius: 10px; overflow: hidden; }
  .pd-specs__row {
    display: grid; grid-template-columns: 200px 1fr;
    border-bottom: 1px solid #E8EDF3;
  }
  .pd-specs__row:last-child { border-bottom: none; }
  .pd-specs__row:nth-child(even) { background: #F8FAFC; }
  .pd-specs__row--full { grid-template-columns: 1fr; }
  .pd-specs__key {
    padding: 12px 16px; font-size: 13.5px;
    font-weight: 600; color: #5A7184;
    border-right: 1px solid #E8EDF3;
  }
  .pd-specs__val { padding: 12px 16px; font-size: 13.5px; color: #0A2540; }
  @media (max-width: 560px) {
    .pd-specs__row { grid-template-columns: 1fr; }
    .pd-specs__key { border-right: none; border-bottom: 1px solid #E8EDF3; padding-bottom: 6px; }
    .pd-specs__val { padding-top: 6px; }
  }

  /* RELATED */
  .pd-related { margin-bottom: 40px; }
  .pd-related__title {
    font-size: 20px; font-weight: 700;
    color: #0A2540; margin: 0 0 20px;
  }
  .pd-related__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }
  .pd-rcard {
    background: white;
    border: 1.5px solid #E3E8EF;
    border-radius: 12px; overflow: hidden;
    text-decoration: none;
    transition: all 0.22s;
    display: flex; flex-direction: column;
  }
  .pd-rcard:hover {
    border-color: rgba(0,119,204,0.35);
    box-shadow: 0 6px 20px rgba(10,37,64,0.1);
    transform: translateY(-2px);
  }
  .pd-rcard__img-wrap {
    position: relative; width: 100%; aspect-ratio: 1/1;
    background: #F5F7FA; border-bottom: 1px solid #E8EDF3;
  }
  .pd-rcard__img { object-fit: contain; padding: 10px; }
  .pd-rcard__no-img {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: #CBD5E0;
  }
  .pd-rcard__body { padding: 12px 14px; flex: 1; }
  .pd-rcard__name {
    font-size: 13px; font-weight: 500; color: #0A2540;
    line-height: 1.4; margin: 0 0 6px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pd-rcard__price { font-size: 14px; font-weight: 700; color: #0A2540; margin: 0; }

  /* BACK */
  .pd-back { margin-top: 12px; }
  .pd-btn-back {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 20px;
    background: #F5F7FA; border: 1.5px solid #E3E8EF;
    border-radius: 10px; font-size: 13.5px;
    font-weight: 600; color: #5A7184;
    cursor: pointer; text-decoration: none;
    transition: all 0.2s;
  }
  .pd-btn-back:hover { background: #0A2540; color: white; border-color: #0A2540; }

  /* LIGHTBOX */
  .pd-lightbox {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(5,15,30,0.92);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.18s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .pd-lightbox__inner {
    position: relative;
    width: min(90vw, 800px);
    aspect-ratio: 1/1;
    background: #111;
    border-radius: 12px; overflow: hidden;
  }
  .pd-lightbox__img { object-fit: contain; padding: 16px; }
  .pd-lightbox__close {
    position: absolute; top: 12px; right: 14px;
    z-index: 2; background: rgba(255,255,255,0.15);
    border: none; color: white; border-radius: 8px;
    width: 36px; height: 36px; font-size: 18px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .pd-lightbox__close:hover { background: rgba(255,255,255,0.3); }
  .pd-lightbox__nav {
    position: absolute; top: 50%; transform: translateY(-50%);
    z-index: 2; background: rgba(255,255,255,0.12);
    border: none; color: white; border-radius: 50%;
    width: 48px; height: 48px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .pd-lightbox__nav:hover { background: rgba(255,255,255,0.25); }
  .pd-lightbox__nav--prev { left: 12px; }
  .pd-lightbox__nav--next { right: 12px; }
  .pd-lightbox__counter {
    position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.5); color: white;
    padding: 4px 14px; border-radius: 20px; font-size: 13px;
  }

  /* ERROR */
  .pd-error {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 60vh; gap: 16px; color: #A0AEC0;
    text-align: center;
  }
  .pd-error h2 { font-size: 18px; color: #5A7184; margin: 0; }
  .pd-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; background: #0A2540; color: white;
    border: none; border-radius: 10px; font-size: 14px;
    font-weight: 600; cursor: pointer; text-decoration: none;
    transition: opacity 0.2s; margin-top: 8px;
  }
  .pd-btn-primary:hover { opacity: 0.88; }
`;

const skeletonCSS = `
  .pd-skeleton {
    max-width: 1200px; margin: 32px auto;
    padding: 0 20px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 48px;
  }
  @media (max-width: 768px) { .pd-skeleton { grid-template-columns: 1fr; } }
  .pd-skeleton__img {
    width: 100%; aspect-ratio: 1/1;
    border-radius: 16px;
    background: linear-gradient(90deg, #EEF1F6 25%, #E4E8EF 50%, #EEF1F6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  .pd-skeleton__body { display: flex; flex-direction: column; gap: 14px; padding-top: 12px; }
  .pd-skeleton__line {
    border-radius: 6px;
    background: linear-gradient(90deg, #EEF1F6 25%, #E4E8EF 50%, #EEF1F6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  .pd-skeleton__line--lg { height: 32px; width: 80%; }
  .pd-skeleton__line--md { height: 18px; width: 55%; }
  .pd-skeleton__line--sm { height: 14px; width: 40%; }
  .pd-skeleton__line--btn { height: 50px; width: 100%; margin-top: 20px; border-radius: 12px; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;
