"use client";

import { useEffect, useMemo, useState } from "react";

import { auth } from "../../firebase/index";
import { useAuth } from "../context/AuthContext";

const EMPTY_PERIODS = {
  today: { label: "Bugun", uniqueVisitors: 0, totalVisits: 0 },
  week: { label: "Bu hafta", uniqueVisitors: 0, totalVisits: 0 },
  month: { label: "Bu ay", uniqueVisitors: 0, totalVisits: 0 },
  year: { label: "Bu yil", uniqueVisitors: 0, totalVisits: 0 },
};

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

export default function VisitorStatsPanel() {
  const { user, loading: authLoading } = useAuth();
  const [periods, setPeriods] = useState(EMPTY_PERIODS);
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
          throw new Error(data?.error || "Ziyaretci istatistikleri alinamadi.");
        }

        if (!cancelled) {
          setPeriods({ ...EMPTY_PERIODS, ...(data?.periods || {}) });
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
                <div className="mt-2 text-2xl font-bold text-slate-950">
                  {loading ? "..." : formatNumber(card.uniqueVisitors)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Toplam
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950">
                  {loading ? "..." : formatNumber(card.totalVisits)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
