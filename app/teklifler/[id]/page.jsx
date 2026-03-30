"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, FileText, Loader2, Mail, MapPin, Phone, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getQuoteRequestById, QUOTE_STATUSES } from "../../services/quoteService";

function formatDate(value) {
  if (!value) return "-";
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPrice(value) {
  if (typeof value !== "number") return "-";
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}

const statusTone = {
  new: "bg-blue-50 text-blue-700",
  reviewing: "bg-amber-50 text-amber-700",
  priced: "bg-violet-50 text-violet-700",
  answered: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-50 text-red-700",
  draft: "bg-slate-100 text-slate-700",
};

export default function QuoteDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getQuoteRequestById(id);
        if (!data) {
          setError("Teklif bulunamadı.");
          setItem(null);
          return;
        }
        setItem(data);
      } catch (err) {
        console.error(err);
        setError("Teklif detayı yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id]);

  const isAllowed = useMemo(() => {
    if (!item || !user?.uid) return false;
    return item.userId === user.uid || user.role === "admin";
  }, [item, user?.uid, user?.role]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,35,35,0.08)]">
          <p className="text-lg font-semibold text-slate-900">{error}</p>
        </div>
      </main>
    );
  }

  if (!isAllowed) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,35,35,0.08)]">
          <p className="text-lg font-semibold text-slate-900">Bu teklif kaydını görme yetkin yok.</p>
        </div>
      </main>
    );
  }

  const statusKey = item.status || "new";
  const statusLabel = QUOTE_STATUSES[statusKey]?.label || statusKey;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/teklifler" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
            <ArrowLeft size={18} />
            Teklif geçmişine dön
          </Link>

          <span className={`rounded-full px-4 py-2 text-sm font-semibold ${statusTone[statusKey] || statusTone.new}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <section className="rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,35,35,0.08)] md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Teklif kaydı</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{item.quoteNo || item.id}</h1>
              </div>

              <div className="text-sm text-slate-600">
                <div>Oluşturma: {formatDate(item.createdAt)}</div>
                <div>Güncelleme: {formatDate(item.updatedAt)}</div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {(item.items || []).map((product, index) => (
                <div key={`${product.productId}-${index}`} className="grid gap-4 rounded-3xl bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {product.brand || product.sku || "Ürün"}
                    </div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{product.name || "Ürün"}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                      {product.sku ? <span>SKU: {product.sku}</span> : null}
                      <span>Birim: {product.unit || "adet"}</span>
                      <span>Miktar: {product.quantity}</span>
                      {typeof product.price === "number" ? <span>Liste: {formatPrice(product.price)}</span> : null}
                    </div>
                  </div>

                  <div className="text-right text-sm text-slate-700">
                    {typeof product.price === "number" ? formatPrice(product.price * product.quantity) : "Fiyat bekleniyor"}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,35,35,0.08)] md:p-7">
              <h2 className="text-xl font-semibold text-slate-900">Müşteri bilgileri</h2>
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <InfoRow icon={<User size={16} />} label="Ad soyad" value={item.customer?.fullName} />
                <InfoRow icon={<Building2 size={16} />} label="Firma" value={item.customer?.companyName} />
                <InfoRow icon={<Phone size={16} />} label="Telefon" value={item.customer?.phone} />
                <InfoRow icon={<Mail size={16} />} label="E-posta" value={item.customer?.email} />
                <InfoRow icon={<MapPin size={16} />} label="Şehir" value={item.customer?.city} />
                <InfoRow icon={<User size={16} />} label="Pozisyon" value={item.customer?.position} />
                <InfoRow icon={<MapPin size={16} />} label="Teslim şehri" value={item.requestedDeliveryCity} />
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,35,35,0.08)] md:p-7">
              <h2 className="text-xl font-semibold text-slate-900">Talep notu</h2>
              <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {item.note || "Not girilmemiş."}
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Kalem sayısı</span>
                  <strong>{item.itemCount || item.items?.length || 0}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Toplam miktar</span>
                  <strong>{item.totalQuantity || 0}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Termin talebi</span>
                  <strong>{item.requestedTermDays ? `${item.requestedTermDays} gün` : "-"}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right font-medium text-slate-900">{value || "-"}</div>
    </div>
  );
}
