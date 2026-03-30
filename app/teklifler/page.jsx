"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserQuoteRequests, QUOTE_STATUSES } from "../services/quoteService";

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

const statusTone = {
  new: "bg-blue-50 text-blue-700",
  reviewing: "bg-amber-50 text-amber-700",
  priced: "bg-violet-50 text-violet-700",
  answered: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-50 text-red-700",
  draft: "bg-slate-100 text-slate-700",
};

export default function QuoteHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getUserQuoteRequests(user.uid);
        setItems(data);
      } catch (err) {
        console.error(err);
        setError("Teklif geçmişi yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user?.uid]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (!user?.uid) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,35,35,0.08)]">
          <FileText className="mx-auto text-slate-400" size={36} />
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Teklif geçmişi için giriş gerekli</h1>
          <p className="mt-2 text-sm text-slate-600">Sana ait teklifleri göstermek için oturum açılmış kullanıcı lazım.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            Giriş yap
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Teklif geçmişi</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Gönderilen talepler</h1>
          </div>

          <Link href="/teklif-talep" className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            Yeni teklif oluştur
          </Link>
        </div>

        {error ? <div className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {!items.length ? (
          <div className="rounded-[28px] bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,35,35,0.08)]">
            <p className="text-lg font-semibold text-slate-900">Henüz teklif talebi yok.</p>
            <p className="mt-2 text-sm text-slate-600">Ürün detayından teklif talebi başlat.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => {
              const statusKey = item.status || "new";
              const statusLabel = QUOTE_STATUSES[statusKey]?.label || statusKey;

              return (
                <Link
                  key={item.id}
                  href={`/teklifler/${item.id}`}
                  className="grid gap-5 rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,35,35,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_32px_70px_rgba(15,35,35,0.12)] md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-semibold text-slate-900">{item.quoteNo || item.id}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[statusKey] || statusTone.new}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <span>Firma: {item.customer?.companyName || "-"}</span>
                      <span>Kalem: {item.itemCount || item.items?.length || 0}</span>
                      <span>Tarih: {formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    Detaya git
                    <ArrowRight size={18} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
