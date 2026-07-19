"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";

import { auth } from "../../firebase/index";
import { db } from "../../firebase/index";
import {
  buildVisitorPeriods,
  DASHBOARD_TIMEZONE,
  getRangeStarts,
} from "../lib/analytics/visitorPeriods";
import { buildVisitorDetails } from "../lib/analytics/visitorDetails";
import { useAuth } from "../context/AuthContext";

const EMPTY_PERIODS = {
  today: {
    label: "Bugun",
    uniqueVisitors: 0,
    totalVisits: 0,
    globalUniqueVisitors: 0,
    globalTotalVisits: 0,
    kazakhstanUniqueVisitors: 0,
    kazakhstanTotalVisits: 0,
  },
  week: {
    label: "Bu hafta",
    uniqueVisitors: 0,
    totalVisits: 0,
    globalUniqueVisitors: 0,
    globalTotalVisits: 0,
    kazakhstanUniqueVisitors: 0,
    kazakhstanTotalVisits: 0,
  },
  month: {
    label: "Bu ay",
    uniqueVisitors: 0,
    totalVisits: 0,
    globalUniqueVisitors: 0,
    globalTotalVisits: 0,
    kazakhstanUniqueVisitors: 0,
    kazakhstanTotalVisits: 0,
  },
  year: {
    label: "Bu yil",
    uniqueVisitors: 0,
    totalVisits: 0,
    globalUniqueVisitors: 0,
    globalTotalVisits: 0,
    kazakhstanUniqueVisitors: 0,
    kazakhstanTotalVisits: 0,
  },
};

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: DASHBOARD_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shortVisitorId(value) {
  const text = String(value || "");
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

async function loadStatsFromFirestore() {
  const ranges = getRangeStarts();
  const detailStart = new Date(ranges.now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [snapshot, pageViewSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, "visit_logs"),
        where("visitedAt", ">=", ranges.startOfYear),
        where("visitedAt", "<=", ranges.now)
      )
    ),
    getDocs(
      query(
        collection(db, "page_view_logs"),
        where("visitedAt", ">=", detailStart),
        orderBy("visitedAt", "desc"),
        limit(1000)
      )
    ),
  ]);

  return {
    ok: true,
    timezone: DASHBOARD_TIMEZONE,
    generatedAt: ranges.now.toISOString(),
    periods: buildVisitorPeriods(snapshot.docs.map((doc) => doc.data() || {}), ranges),
    visitorDetails: buildVisitorDetails(pageViewSnapshot.docs.map((doc) => doc.data() || {})),
    detailPeriodDays: 30,
    detailRowsLimited: pageViewSnapshot.size >= 1000,
  };
}

export default function VisitorStatsPanel() {
  const { user, loading: authLoading } = useAuth();
  const [periods, setPeriods] = useState(EMPTY_PERIODS);
  const [visitorDetails, setVisitorDetails] = useState([]);
  const [detailRowsLimited, setDetailRowsLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;

    async function loadStats() {
      try {
        setLoading(true);
        setError("");

        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error("Yetkili oturumu bulunamadi.");
        }

        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/admin/analytics/overview", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.ok !== true) {
          if (String(data?.error || "").includes("Firebase Admin env degiskenleri eksik")) {
            const fallback = await loadStatsFromFirestore();

            if (!cancelled) {
              setPeriods({ ...EMPTY_PERIODS, ...(fallback?.periods || {}) });
              setVisitorDetails(fallback?.visitorDetails || []);
              setDetailRowsLimited(fallback?.detailRowsLimited === true);
            }

            return;
          }

          throw new Error(data?.error || "Ziyaretci istatistikleri alinamadi.");
        }

        if (!cancelled) {
          setPeriods({ ...EMPTY_PERIODS, ...(data?.periods || {}) });
          setVisitorDetails(data?.visitorDetails || []);
          setDetailRowsLimited(data?.detailRowsLimited === true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Ziyaretci istatistikleri alinamadi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const cards = useMemo(
    () => [periods.today, periods.week, periods.month, periods.year],
    [periods]
  );

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Ziyaretci ozeti
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Public ziyaret hareketi
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Bu panel sadece public ziyaretleri sayar. Login olan yetkili ve personel hesaplari bu sayaca dahil edilmez.
          Kazakhstan degerleri yesil, global toplamlar mavi gosterilir.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
          >
            <div className="text-sm font-semibold text-slate-800">{card.label}</div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Tekil
                </div>
                <div className="mt-2 flex items-baseline gap-2 text-2xl font-bold">
                  <span className="text-emerald-600">
                    {loading ? "..." : formatNumber(card.kazakhstanUniqueVisitors)}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-sky-600">
                    {loading ? "..." : formatNumber(card.globalUniqueVisitors || card.uniqueVisitors)}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                  KZ / Global
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Toplam
                </div>
                <div className="mt-2 flex items-baseline gap-2 text-2xl font-bold">
                  <span className="text-emerald-600">
                    {loading ? "..." : formatNumber(card.kazakhstanTotalVisits)}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-sky-600">
                    {loading ? "..." : formatNumber(card.globalTotalVisits || card.totalVisits)}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                  KZ / Global
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Ziyaretci sayfa detaylari</h3>
            <p className="mt-1 text-sm text-slate-600">
              Son 30 gunde hangi anonim ziyaretcinin hangi sayfa ve urunleri inceledigini gosterir.
            </p>
          </div>
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            {loading ? "Yukleniyor..." : `${formatNumber(visitorDetails.length)} ziyaretci`}
          </div>
        </div>

        {detailRowsLimited ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Son 1.000 sayfa hareketi gosteriliyor. Daha eski detaylar bu listede yer almayabilir.
          </div>
        ) : null}

        {!loading && visitorDetails.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
            Henuz sayfa goruntuleme kaydi bulunmuyor. Yeni public ziyaretler burada gorunecek.
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {visitorDetails.map((visitor) => (
            <details
              key={visitor.visitorId}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
            >
              <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900" title={visitor.visitorId}>
                    {shortVisitorId(visitor.visitorId)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {visitor.country || "Ulke bilinmiyor"} · Son hareket {formatDateTime(visitor.lastVisitedAt)}
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{formatNumber(visitor.uniquePageCount)}</span> sayfa
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{formatNumber(visitor.pageViewCount)}</span> goruntuleme
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{formatNumber(visitor.sessionCount)}</span> oturum
                </div>
              </summary>

              <div className="border-t border-slate-200 bg-white px-5 py-4">
                <div className="space-y-2">
                  {visitor.pages.map((page) => (
                    <div
                      key={page.pathname}
                      className="flex flex-col gap-2 rounded-xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={page.pathname}
                            target="_blank"
                            className="truncate text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                          >
                            {page.label}
                          </Link>
                          {page.pageType === "product" ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                              Urun
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-400">{page.pathname}</div>
                      </div>
                      <div className="shrink-0 text-xs text-slate-500">
                        {formatNumber(page.viewCount)} goruntuleme · {formatDateTime(page.lastVisitedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
