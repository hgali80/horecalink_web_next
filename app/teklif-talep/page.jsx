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
  Building2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  User,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../context/AuthContext";
import {
  clearQuoteDraft,
  getQuoteDraft,
  removeFromQuoteDraft,
  saveQuoteDraft,
} from "../services/quoteDraftService";
import { createQuoteRequest } from "../services/quoteService";

function formatPrice(value) {
  if (typeof value !== "number") return null;
  return new Intl.NumberFormat("ru-RU").format(value);
}

function buildImage(product) {
  if (product?.image_names?.[0]) {
    return `/images/products/${product.image_names[0]}`;
  }
  if (product?.image) return product.image;
  return "";
}

function normalizeProduct(product) {
  return {
    id: product.id,
    sku: product.sku || product.barcode || product.manufacturerCode || "",
    name: product.name_ru || product.name || product.name_tr || "Ürün",
    brand: product.brand || "",
    unit: product.unit || "adet",
    price: typeof product.price === "number" ? product.price : Number(product.price) || null,
    groupKey: product.groupKey || "",
    categoryKey: product.categoryKey || "",
    subcategoryKey: product.subcategoryKey || "",
    image: buildImage(product),
  };
}

export default function QuoteRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    phone: "",
    email: "",
    city: "",
    position: "",
    requestedDeliveryCity: "",
    requestedTermDays: "",
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
      position: prev.position || user.position || "",
      requestedDeliveryCity: prev.requestedDeliveryCity || user.city || "",
    }));
  }, [user]);

  useEffect(() => {
    const singleProductId = searchParams.get("product");
    const qty = Number(searchParams.get("qty") || 1);
    const currentDraft = getQuoteDraft();

    if (singleProductId) {
      const existing = currentDraft.find((item) => item.productId === singleProductId);
      const nextDraft = existing
        ? currentDraft.map((item) =>
            item.productId === singleProductId
              ? { ...item, quantity: Math.max(1, qty) }
              : item
          )
        : [...currentDraft, { productId: singleProductId, quantity: Math.max(1, qty) }];

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
          snap.docs.forEach((docItem) => docs.push({ id: docItem.id, ...docItem.data() }));
        }

        const mapped = draft
          .map((draftItem) => {
            const product = docs.find((docItem) => docItem.id === draftItem.productId);
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
  }, [searchParams]);

  const summary = useMemo(() => {
    return {
      lineCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: items.reduce((sum, item) => {
        if (typeof item.price !== "number") return sum;
        return sum + item.price * item.quantity;
      }, 0),
    };
  }, [items]);

  const updateQuantity = (productId, quantity) => {
    const next = items.map((item) =>
      item.id === productId ? { ...item, quantity: Math.max(1, Number(quantity) || 1) } : item
    );
    setItems(next);
    saveQuoteDraft(next.map((item) => ({ productId: item.id, quantity: item.quantity })));
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

    if (!user?.uid) {
      router.push("/login");
      return;
    }

    if (!items.length) {
      setError("Teklif için en az bir ürün olmalı.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const quoteId = await createQuoteRequest({
        user,
        form,
        items,
      });

      clearQuoteDraft();
      router.push(`/teklifler/${quoteId}`);
    } catch (err) {
      console.error(err);
      setError("Teklif talebi oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Kataloğa dön
          </Link>

          <Link
            href="/teklifler"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100"
          >
            <FileText size={18} />
            Teklif geçmişi
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,35,35,0.08)] md:p-7">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Teklif talebi
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Ürün listesini gönder
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Miktarları net yaz. Fiyat, termin ve teslim bilgisi satış ekibi tarafından teklif üzerinde dönecek.
              </p>
            </div>

            {error ? (
              <div className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl bg-slate-50">
                <Loader2 className="animate-spin text-slate-500" />
              </div>
            ) : !items.length ? (
              <div className="rounded-3xl bg-slate-50 p-8 text-center">
                <p className="text-lg font-semibold text-slate-900">Teklif listen boş.</p>
                <p className="mt-2 text-sm text-slate-600">Ürün kartından veya ürün detayından teklif listesine ekleme yap.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-4 rounded-3xl bg-slate-50 p-4 md:grid-cols-[96px_1fr_auto] md:items-center"
                  >
                    <div className="h-24 w-24 overflow-hidden rounded-2xl bg-white">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {item.brand || item.sku || "Ürün"}
                      </div>
                      <div className="mt-1 text-base font-semibold text-slate-900">
                        {item.name}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                        {item.sku ? <span>SKU: {item.sku}</span> : null}
                        {typeof item.price === "number" ? <span>{formatPrice(item.price)} ₸</span> : null}
                        <span>Birim: {item.unit}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.id, event.target.value)}
                        className="w-24 rounded-2xl border-0 bg-white px-4 py-3 text-right text-sm font-semibold text-slate-900 shadow-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,35,35,0.08)] md:p-7">
              <h2 className="text-xl font-semibold text-slate-900">Talep özeti</h2>
              <div className="mt-5 space-y-4 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Kalem sayısı</span>
                  <strong>{summary.lineCount}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Toplam miktar</span>
                  <strong>{summary.totalQuantity}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Liste tutarı</span>
                  <strong>
                    {summary.totalAmount ? `${formatPrice(summary.totalAmount)} ₸` : "Fiyatsız kalem var"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,35,35,0.08)] md:p-7">
              <h2 className="text-xl font-semibold text-slate-900">Talep bilgileri</h2>

              <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                <Field icon={<User size={16} />} label="Ad soyad" name="fullName" value={form.fullName} onChange={handleChange} required />
                <Field icon={<Building2 size={16} />} label="Firma" name="companyName" value={form.companyName} onChange={handleChange} required />
                <Field icon={<Phone size={16} />} label="Telefon" name="phone" value={form.phone} onChange={handleChange} required />
                <Field icon={<Mail size={16} />} label="E-posta" name="email" type="email" value={form.email} onChange={handleChange} required />
                <Field icon={<MapPin size={16} />} label="Şehir" name="city" value={form.city} onChange={handleChange} />
                <Field icon={<User size={16} />} label="Pozisyon" name="position" value={form.position} onChange={handleChange} />
                <Field icon={<MapPin size={16} />} label="Teslim şehri" name="requestedDeliveryCity" value={form.requestedDeliveryCity} onChange={handleChange} />
                <Field label="İstenen termin (gün)" name="requestedTermDays" type="number" value={form.requestedTermDays} onChange={handleChange} />

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Not</span>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleChange}
                    rows={5}
                    className="w-full rounded-3xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-slate-900"
                    placeholder="Ödeme şekli, termin beklentisi, proje bilgisi, marka tercihi..."
                  />
                </label>

                {!user?.uid ? (
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Giriş yap ve devam et
                  </Link>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || !items.length}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Gönderiliyor..." : "Teklif talebini gönder"}
                  </button>
                )}
              </form>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({ icon, label, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
        {icon ? <span className="text-slate-500">{icon}</span> : null}
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-3xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-slate-900"
      />
    </label>
  );
}
