"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Eye, MapPin, Users } from "lucide-react";

import { auth } from "../../firebase/index";
import { useAuth } from "../context/AuthContext";
import { loadAdminAnalytics } from "../services/adminAnalyticsService";

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

export default function VisitorAnalyticsCard() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    async function loadToday() {
      try {
        setLoading(true);
        setError("");
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Yetkili oturumu bulunamadı.");
        const idToken = await currentUser.getIdToken();
        const data = await loadAdminAnalytics({
          idToken,
          rangeKey: "today",
          includeDetails: false,
        });
        if (!cancelled) setSummary(data.summary || {});
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || "Bugünkü ziyaret verisi alınamadı.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadToday();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return (
    <Link
      href="/satissitok/admin/analytics"
      className="group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md sm:col-span-2 lg:col-span-2"
    >
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-100/70 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
          <BarChart3 size={22} />
        </div>
        <ArrowUpRight
          size={20}
          className="text-cyan-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </div>

      <div className="relative mt-5">
        <div className="text-sm font-medium text-slate-500">Bugünkü ziyaretçi</div>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-4xl font-bold tracking-tight text-slate-950">
            {loading ? "…" : error ? "—" : formatNumber(summary?.uniqueVisitors)}
          </span>
          <span className="pb-1 text-sm font-medium text-slate-500">tekil ziyaretçi</span>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <Eye size={16} className="text-sky-600" />
          <span><strong className="text-slate-900">{loading ? "…" : formatNumber(summary?.pageViews)}</strong> görüntüleme</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin size={16} className="text-emerald-600" />
          <span><strong className="text-slate-900">{loading ? "…" : formatNumber(summary?.kazakhstanVisitors)}</strong> KZ</span>
        </div>
      </div>

      <div className="relative mt-auto pt-5">
        {error ? (
          <div className="text-xs text-rose-600">{error}</div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
            <Users size={16} />
            Detaylı analizi görüntüle
          </div>
        )}
      </div>
    </Link>
  );
}
