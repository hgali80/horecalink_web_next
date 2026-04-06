"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import {
  getQuoteStatusLabelKey,
  getGuestQuoteRequests,
  getUserQuoteRequests,
  normalizeQuoteStatus,
} from "../services/quoteService";

function formatDate(value, lang) {
  if (!value) return "-";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  const localeMap = {
    tr: "tr-TR",
    ru: "ru-RU",
    kz: "kk-KZ",
    en: "en-US",
  };

  return new Intl.DateTimeFormat(localeMap[lang] || "tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const statusTone = {
  new: "bg-blue-50 text-blue-700",
  received: "bg-blue-50 text-blue-700",
  reviewing: "bg-amber-50 text-amber-700",
  priced: "bg-violet-50 text-violet-700",
  preparing: "bg-violet-50 text-violet-700",
  answered: "bg-emerald-50 text-emerald-700",
  offered: "bg-emerald-50 text-emerald-700",
  approved: "bg-emerald-50 text-emerald-700",
  in_delivery: "bg-cyan-50 text-cyan-700",
  closed: "bg-slate-100 text-slate-700",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-50 text-red-700",
  draft: "bg-slate-100 text-slate-700",
};

export default function QuoteHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang, t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");

        const data = user?.uid
          ? await getUserQuoteRequests(user.uid)
          : await getGuestQuoteRequests();

        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError(t("quoteHistory.error"));
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      run();
    }
  }, [authLoading, t, user?.uid]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f8f9fb]">
        <Loader2 className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
              {t("quoteHistory.eyebrow")}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#1d3246] md:text-4xl">
              {t("quoteHistory.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {t("quoteHistory.description")}
            </p>
          </div>

          <Link
            href="/teklif-talep"
            className="inline-flex rounded-lg bg-gradient-to-r from-[#1d3246] to-[#34495e] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.12em] text-white"
          >
            {t("quoteHistory.createNew")}
          </Link>
        </div>

        {!user ? (
          <div className="mb-6 rounded-xl border border-[#dbe4ee] bg-white px-5 py-4 text-sm leading-6 text-slate-600 shadow-sm">
            {t("quoteHistory.guestInfo")}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!items.length ? (
          <div className="rounded-xl bg-white p-10 text-center shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
            <FileText className="mx-auto text-slate-300" size={40} />
            <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-[#1d3246]">
              {t("quoteHistory.emptyTitle")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{t("quoteHistory.emptyText")}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => {
              const rawStatusKey = item.status || "new";
              const statusKey = normalizeQuoteStatus(rawStatusKey);
              const statusLabel = t(getQuoteStatusLabelKey(rawStatusKey));

              const href = item.userId
                ? `/teklifler/${item.id}`
                : item.accessKey
                  ? `/teklifler/${item.id}?access=${encodeURIComponent(item.accessKey)}`
                  : `/teklifler/${item.id}`;

              return (
                <Link
                  key={item.id}
                  href={href}
                  className="grid gap-5 rounded-xl bg-white p-5 shadow-[0_20px_40px_rgba(29,50,70,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(29,50,70,0.1)] md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-extrabold text-[#1d3246]">
                        {item.quoteNo || item.id}
                      </span>

                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[statusKey] || statusTone.new}`}>
                        {statusLabel}
                      </span>

                      {!item.userId ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          {t("quoteHistory.guestBadge")}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-4">
                      <span>{t("quoteHistory.company")}: {item.customer?.companyName || "-"}</span>
                      <span>{t("quoteHistory.items")}: {item.itemCount || item.items?.length || 0}</span>
                      <span>{t("quoteHistory.quantity")}: {item.totalQuantity || 0}</span>
                      <span>{t("quoteHistory.date")}: {formatDate(item.createdAt, lang)}</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1d3246]">
                    {t("quoteHistory.openDetail")}
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
