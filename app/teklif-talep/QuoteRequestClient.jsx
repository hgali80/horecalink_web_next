//app/teklif-talep/QuoteRequestClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  ChevronRight,
  ContactRound,
  FilePlus2,
  FileText,
  History,
  Loader2,
  Minus,
  Package2,
  Plus,
  Send,
  Trash2,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../context/AuthContext";
import {
  clearQuoteDraft,
  getQuoteDraft,
  removeFromQuoteDraft,
  saveQuoteDraft,
} from "../services/quoteDraftService";
import {
  createQuoteRequest,
  getUserQuoteRequests,
} from "../services/quoteService";

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatDate(value) {
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value
          ? new Date(value)
          : null;

    if (!date || Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "-";
  }
}

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";

function buildImage(product) {
  const imageName = Array.isArray(product?.image_names)
    ? product.image_names[0]
    : null;

  if (!imageName || typeof imageName !== "string") return "";

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(imageName)}?alt=media`;
}

function normalizeProduct(product) {
  return {
    id: product.id,
    sku: product.sku || product.barcode || product.manufacturerCode || "",
    name: product.name_ru || product.name || product.name_tr || "Ürün",
    brand: product.brand || "",
    unit: product.unit || "adet",
    price:
      typeof product.price === "number"
        ? product.price
        : Number(product.price) || null,
    slug: product.slug || product.seo?.canonicalSlug || product.id,
    groupKey: product.groupKey || "",
    categoryKey: product.categoryKey || "",
    subcategoryKey: product.subcategoryKey || "",
    image: buildImage(product),
  };
}

function getStatusMeta(status) {
  switch (status) {
    case "reviewing":
    case "new":
      return {
        label: "İncelemede",
        progress: 20,
        badgeClass: "bg-[#1d3246] text-white",
      };
    case "priced":
    case "answered":
      return {
        label: "Kabul Edildi",
        progress: 40,
        badgeClass: "bg-[#dbeafe] text-[#1d4ed8]",
      };
    case "preparing":
      return {
        label: "Hazırlanıyor",
        progress: 60,
        badgeClass: "bg-[#fde7c2] text-[#8a5a00]",
      };
    case "shipping":
      return {
        label: "Yolda",
        progress: 80,
        badgeClass: "bg-[#dcfce7] text-[#166534]",
      };
    case "delivered":
      return {
        label: "Teslim Edildi",
        progress: 100,
        badgeClass: "bg-[#dcfce7] text-[#166534]",
      };
    case "cancelled":
      return {
        label: "İptal",
        progress: 0,
        badgeClass: "bg-red-100 text-red-700",
      };
    default:
      return {
        label: "İncelemede",
        progress: 20,
        badgeClass: "bg-[#1d3246] text-white",
      };
  }
}

function QuoteHistoryCard({ item }) {
  const meta = getStatusMeta(item?.status);
  const total =
    Number(item?.pricing?.specialAmount) ||
    Number(item?.pricing?.listAmount) ||
    Number(item?.totalAmount) ||
    0;

  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Talep No
          </div>
          <h3 className="mt-1 text-[28px] font-extrabold tracking-[-0.04em] text-[#1d3246]">
            #{item?.quoteNo || item?.id}
          </h3>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Tarih
          </div>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {formatDate(item?.createdAt)}
          </p>
        </div>
      </div>

      <div className="mb-7">
        <div className="mb-2 flex items-end justify-between gap-4">
          <span className="text-sm font-bold text-[#1d3246]">
            Toplam Tutar: ₸{formatPrice(total || 0)}
          </span>

          <span
            className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
        </div>

        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
            <div
              className="h-full rounded-full bg-[#1d3246] transition-all duration-500"
              style={{ width: `${meta.progress}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
            <span className={meta.progress >= 20 ? "text-[#1d3246]" : ""}>
              İncelemede
            </span>
            <span className={meta.progress >= 40 ? "text-[#1d3246]" : ""}>
              Kabul Edildi
            </span>
            <span className={meta.progress >= 60 ? "text-[#1d3246]" : ""}>
              Hazırlanıyor
            </span>
            <span className={meta.progress >= 80 ? "text-[#1d3246]" : ""}>
              Yolda
            </span>
            <span className={meta.progress >= 100 ? "text-[#1d3246]" : ""}>
              Teslim
            </span>
          </div>
        </div>
      </div>

      <Link
        href={`/teklifler/${item?.id}`}
        className="inline-flex w-full items-center justify-center rounded-xl border border-[#cbd5e1] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#1d3246] transition hover:bg-slate-50"
      >
        Detayları Görüntüle
      </Link>
    </div>
  );
}

export default function QuoteRequestClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const productId = searchParams.get("product") || searchParams.get("productId");
  const qtyParam = searchParams.get("qty");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);

  const [form, setForm] = useState({
    companyName: "",
    fullName: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    note: "",
  });

  useEffect(() => {
    if (!user) return;

    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || user.fullName || "",
      companyName: prev.companyName || user.businessName || "",
      phone: prev.phone || user.phone || "",
      email: prev.email || user.email || "",
      city: prev.city || user.city || "",
    }));
  }, [user]);

  useEffect(() => {
    const qty = Number(qtyParam || 1);
    const currentDraft = getQuoteDraft();

    if (productId) {
      const existing = currentDraft.find((item) => item.productId === productId);
      const nextDraft = existing
        ? currentDraft.map((item) =>
            item.productId === productId
              ? { ...item, quantity: Math.max(1, qty) }
              : item
          )
        : [...currentDraft, { productId, quantity: Math.max(1, qty) }];

      saveQuoteDraft(nextDraft);
    }

    const draft = getQuoteDraft();

    if (!draft.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const ids = draft.map((item) => item.productId);
        const chunks = [];
        for (let i = 0; i < ids.length; i += 10) {
          chunks.push(ids.slice(i, i + 10));
        }

        const docs = [];
        for (const chunk of chunks) {
          const snap = await getDocs(
            query(collection(db, "products"), where(documentId(), "in", chunk))
          );
          snap.docs.forEach((docItem) =>
            docs.push({ id: docItem.id, ...docItem.data() })
          );
        }

        const mapped = draft
          .map((draftItem) => {
            const product = docs.find(
              (docItem) => docItem.id === draftItem.productId
            );
            if (!product) return null;

            return {
              ...normalizeProduct(product),
              quantity: Number(draftItem.quantity) || 1,
            };
          })
          .filter(Boolean);

        setItems(mapped);
      } catch (err) {
        console.error(err);
        setError("Ürünler yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [productId, qtyParam]);

  useEffect(() => {
    if (!user?.uid) {
      setHistoryItems([]);
      return;
    }

    const run = async () => {
      try {
        setHistoryLoading(true);
        const rows = await getUserQuoteRequests(user.uid);
        setHistoryItems(Array.isArray(rows) ? rows.slice(0, 6) : []);
      } catch (err) {
        console.error(err);
      } finally {
        setHistoryLoading(false);
      }
    };

    run();
  }, [user?.uid]);

  const summary = useMemo(() => {
    const totalAmount = items.reduce((sum, item) => {
      if (typeof item.price !== "number") return sum;
      return sum + item.price * item.quantity;
    }, 0);

    return {
      lineCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount,
    };
  }, [items]);

  const updateQuantity = (productId, quantity) => {
    const parsed = Math.max(1, Number(quantity) || 1);

    const next = items.map((item) =>
      item.id === productId ? { ...item, quantity: parsed } : item
    );

    setItems(next);
    saveQuoteDraft(
      next.map((item) => ({ productId: item.id, quantity: item.quantity }))
    );
  };

  const incrementQty = (productId) => {
    const found = items.find((item) => item.id === productId);
    if (!found) return;
    updateQuantity(productId, found.quantity + 1);
  };

  const decrementQty = (productId) => {
    const found = items.find((item) => item.id === productId);
    if (!found) return;
    updateQuantity(productId, Math.max(1, found.quantity - 1));
  };

  const deleteItem = (productId) => {
    setItems((prev) => prev.filter((item) => item.id !== productId));
    removeFromQuoteDraft(productId);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!items.length) {
      setError("Teklif için en az bir ürün olmalı.");
      return;
    }

    if (!form.fullName.trim()) {
      setError("Yetkili kişi zorunlu.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Telefon zorunlu.");
      return;
    }

    if (!form.address.trim()) {
      setError("Adres zorunlu.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const noteParts = [];
      if (form.address.trim()) {
        noteParts.push(`Adres: ${form.address.trim()}`);
      }
      if (form.note.trim()) {
        noteParts.push(`Not: ${form.note.trim()}`);
      }

      const quoteResult = await createQuoteRequest({
        user,
        form: {
          fullName: form.fullName,
          companyName: form.companyName,
          phone: form.phone,
          email: form.email,
          city: form.city,
          requestedDeliveryCity: form.city,
          note: noteParts.join("\n"),
        },
        items,
      });

      clearQuoteDraft();
      router.push(`/teklifler/${quoteResult.id}`);
    } catch (err) {
      console.error(err);
      setError("Teklif talebi oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f8f9fb]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 pb-14 pt-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-10">
          <nav className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Link href="/" className="transition hover:text-[#1d3246]">
              Ana Sayfa
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-[#1d3246]">Teklif Sepeti</span>
          </nav>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[38px] font-extrabold tracking-[-0.05em] text-[#1d3246] md:text-[48px]">
                Teklif Talebi Oluştur
              </h1>

              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-500">
                Endüstriyel mutfak projeniz için seçtiğiniz ürünleri inceleyin ve
                firmanız için özel fiyatlandırma talep edin.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd5e1] bg-white px-5 py-3 text-sm font-bold text-[#1d3246] shadow-sm transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Kataloğa Dön
              </Link>

              <Link
                href="/catalog"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#243f58]"
              >
                <FilePlus2 className="h-4 w-4" />
                Ürün Ekle
              </Link>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-8 lg:flex-row">
          <section className="lg:w-[68%]">
            <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="bg-[#f2f4f6] text-left">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Ürün Detayı
                      </th>
                      <th className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Birim
                      </th>
                      <th className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Birim Fiyat
                      </th>
                      <th className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Miktar
                      </th>
                      <th className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Toplam
                      </th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        İşlem
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#eef1f4]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <div className="flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                          </div>
                        </td>
                      </tr>
                    ) : !items.length ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <div className="mx-auto max-w-md">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                              <Package2 className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-bold text-[#1d3246]">
                              Teklif listesi boş
                            </h3>
                            <p className="mt-2 text-sm text-slate-500">
                              Ürün kartlarından teklif listesine ürün ekleyip bu
                              sayfaya geri dön.
                            </p>

                            <div className="mt-6">
                              <Link
                                href="/catalog"
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#243f58]"
                              >
                                <FilePlus2 className="h-4 w-4" />
                                Katalogdan Ürün Ekle
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {items.map((item) => {
                          const lineTotal =
                            typeof item.price === "number"
                              ? item.price * item.quantity
                              : 0;

                          return (
                            <tr
                              key={item.id}
                              className="transition hover:bg-[#fafbfc]"
                            >
                              <td className="px-6 py-6">
                                <div className="flex items-center gap-4">
                                  <Link
                                    href={`/products/${item.slug || item.id}`}
                                    className="block h-20 w-20 overflow-hidden rounded-xl bg-[#f2f4f6] transition hover:opacity-90"
                                  >
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="h-full w-full object-cover"
                                        onError={(event) => {
                                          event.currentTarget.style.display =
                                            "none";
                                        }}
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-gray-400 text-xs">
                                        no image
                                      </div>
                                    )}
                                  </Link>

                                  <div className="min-w-0">
                                    <Link
                                      href={`/products/${item.slug || item.id}`}
                                      className="block max-w-[320px] text-[16px] font-bold leading-6 text-[#1d3246] transition hover:text-[#34577a]"
                                    >
                                      {item.name}
                                    </Link>

                                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      Kod: {item.sku || item.id}
                                    </p>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {item.brand ? (
                                        <span className="inline-flex rounded-md bg-[#f4e5c8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a5a00]">
                                          {item.brand}
                                        </span>
                                      ) : null}

                                      <Link
                                        href={`/products/${item.slug || item.id}`}
                                        className="inline-flex items-center text-[11px] font-bold uppercase tracking-[0.1em] text-[#1d3246] transition hover:text-[#34577a]"
                                      >
                                        Ürünü İncele
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-6 text-center text-sm font-medium text-slate-700">
                                {item.unit || "Adet"}
                              </td>

                              <td className="px-4 py-6 text-center text-sm font-bold text-[#1d3246]">
                                {typeof item.price === "number"
                                  ? `₸${formatPrice(item.price)}`
                                  : "-"}
                              </td>

                              <td className="px-4 py-6">
                                <div className="flex items-center justify-center">
                                  <div className="flex items-center rounded-xl bg-[#eef1f4] p-1">
                                    <button
                                      type="button"
                                      onClick={() => decrementQty(item.id)}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-white"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>

                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(event) =>
                                        updateQuantity(
                                          item.id,
                                          event.target.value
                                        )
                                      }
                                      className="h-9 w-12 border-0 bg-transparent p-0 text-center text-sm font-bold text-slate-900 outline-none ring-0"
                                    />

                                    <button
                                      type="button"
                                      onClick={() => incrementQty(item.id)}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-white"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-6 text-center text-sm font-bold text-[#1d3246]">
                                {typeof item.price === "number"
                                  ? `₸${formatPrice(lineTotal)}`
                                  : "-"}
                              </td>

                              <td className="px-6 py-6 text-right">
                                <button
                                  type="button"
                                  onClick={() => deleteItem(item.id)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        <tr className="bg-[#fbfcfd]">
                          <td colSpan={6} className="px-6 py-6">
                            <Link
                              href="/catalog"
                              className="group flex min-h-[112px] items-center justify-between rounded-2xl border border-dashed border-[#cbd5e1] bg-white px-6 py-5 transition hover:border-[#1d3246] hover:bg-slate-50"
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef1f4] text-[#1d3246] transition group-hover:bg-[#1d3246] group-hover:text-white">
                                  <FilePlus2 className="h-8 w-8" />
                                </div>

                                <div>
                                  <div className="text-base font-extrabold tracking-[-0.02em] text-[#1d3246]">
                                    Ürün Ekle
                                  </div>
                                  <p className="mt-1 text-sm text-slate-500">
                                    Kataloğa dönerek teklifinize yeni ürünler
                                    ekleyin.
                                  </p>
                                </div>
                              </div>

                              <div className="text-sm font-bold text-[#1d3246]">
                                Kataloğa Git
                              </div>
                            </Link>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-2xl bg-[#34495e] p-6 text-white">
                <div className="relative z-10">
                  <Wrench className="mb-4 h-7 w-7 opacity-70" />
                  <h3 className="text-xl font-bold">Özel Projelendirme</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-white/80">
                    Sepetinizdeki ürünler için ücretsiz 3D projelendirme
                    hizmetimizden yararlanabilirsiniz. Satış temsilciniz sizinle
                    iletişime geçecektir.
                  </p>
                </div>

                <div className="pointer-events-none absolute -bottom-6 -right-4 text-white/10">
                  <Wrench className="h-28 w-28" />
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-[#eef1f4] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <Truck className="h-5 w-5 text-[#1d3246]" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#1d3246]">
                    Hızlı Teslimat
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Stoklu ürünler için 48 saat içinde kargolama garantisi
                    sunuyoruz.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6 lg:w-[32%]">
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-2">
                <ContactRound className="h-5 w-5 text-[#1d3246]" />
                <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#1d3246]">
                  İletişim Bilgileri
                </h2>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <FormField
                  label="Firma Adı (İsteğe bağlı)"
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="Firma adını giriniz..."
                />

                <FormField
                  label="Yetkili Kişi (Zorunlu)"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Ad soyad"
                  required
                />

                <FormField
                  label="E-posta (İsteğe bağlı)"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="ornek@firma.com"
                />

                <FormField
                  label="Telefon (Zorunlu)"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+7 ..."
                  required
                />

                <FormField
                  label="Şehir (İsteğe bağlı)"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Almatı"
                />

                <FormTextarea
                  label="Adres (Zorunlu)"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Teslimat adresi giriniz..."
                  rows={4}
                  required
                />

                <FormTextarea
                  label="Ek Notlar (İsteğe bağlı)"
                  name="note"
                  value={form.note}
                  onChange={handleChange}
                  placeholder="Marka tercihi, proje detayı, ödeme planı, teslim beklentisi..."
                  rows={4}
                />

                <div className="rounded-2xl bg-[#eef1f4] p-6 shadow-sm">
                  <h3 className="mb-6 text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#1d3246]">
                    Talep Özeti
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Toplam Ürün Adedi</span>
                      <span className="font-bold text-[#1d3246]">
                        {summary.totalQuantity} Ürün
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        Tahmini Toplam (KDV Dahil)
                      </span>
                      <span className="font-bold text-[#1d3246]">
                        ₸{formatPrice(summary.totalAmount || 0)}
                      </span>
                    </div>

                    <div className="h-px bg-slate-300/70" />

                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1d3246]">
                        Teklif Tutarı
                      </span>
                      <span className="text-[12px] italic text-slate-500">
                        Müşteri temsilcisi belirleyecektir
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !items.length}
                    className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d3246] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>
                      {submitting
                        ? "Teklif Gönderiliyor..."
                        : "Teklif Talebi Gönder"}
                    </span>
                    <Send className="h-4 w-4" />
                  </button>

                  <p className="mt-4 px-4 text-center text-[10px] leading-5 text-slate-500">
                    Talep göndererek{" "}
                    <Link href="/privacy" className="underline">
                      Kullanım Koşulları
                    </Link>{" "}
                    ve{" "}
                    <Link href="/privacy" className="underline">
                      Gizlilik Politikamızı
                    </Link>{" "}
                    kabul etmiş olursunuz.
                  </p>
                </div>
              </form>
            </div>
          </aside>
        </div>

        <section className="mt-20">
          <div className="mb-8 flex items-center gap-3">
            <History className="h-7 w-7 text-[#1d3246]" />
            <h2 className="text-[34px] font-extrabold tracking-[-0.04em] text-[#1d3246]">
              Geçmiş Teklif Talepleri
            </h2>
          </div>

          {!user?.uid ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <UserRound className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-4 text-lg font-bold text-[#1d3246]">
                Geçmiş teklifleri görmek için giriş yap
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Kullanıcı hesabına bağlı teklif kayıtları burada listelenecek.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#1d3246] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#243f58]"
              >
                Giriş Yap
              </Link>
            </div>
          ) : historyLoading ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-2xl bg-white">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : historyItems.length ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {historyItems.map((item) => (
                <QuoteHistoryCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-4 text-lg font-bold text-[#1d3246]">
                Henüz teklif talebi yok
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Bu bölümde gönderdiğin teklif talepleri görünecek.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FormField({ label, required, className = "", ...props }) {
  return (
    <label className="block">
      <span className="mb-2 ml-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <input
        {...props}
        required={required}
        className={`w-full rounded-xl border-0 bg-[#f2f4f6] px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-[#cbd5e1] ${className}`}
      />
    </label>
  );
}

function FormTextarea({ label, required, className = "", ...props }) {
  return (
    <label className="block">
      <span className="mb-2 ml-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <textarea
        {...props}
        required={required}
        className={`w-full resize-none rounded-xl border-0 bg-[#f2f4f6] px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-[#cbd5e1] ${className}`}
      />
    </label>
  );
}