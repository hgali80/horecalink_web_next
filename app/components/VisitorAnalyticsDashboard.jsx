"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Globe2,
  Laptop,
  MapPin,
  MousePointerClick,
  Package,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
  Users,
} from "lucide-react";

import { auth } from "../../firebase/index";
import { useAuth } from "../context/AuthContext";
import { loadAdminAnalytics } from "../services/adminAnalyticsService";

const RANGE_OPTIONS = [
  { key: "today", label: "Bugün" },
  { key: "7d", label: "Son 7 gün" },
  { key: "30d", label: "Son 30 gün" },
  { key: "year", label: "Bu yıl" },
];
const PAGE_SIZE = 10;

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Asia/Qyzylorda",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getCountryName(code) {
  if (!code || code === "BILINMIYOR") return "Ülke bilinmiyor";
  try {
    return new Intl.DisplayNames(["tr"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function describeUserAgent(userAgent) {
  const text = String(userAgent || "");
  let device = "Masaüstü";
  let DeviceIcon = Laptop;

  if (/ipad|tablet|playbook|silk/i.test(text)) {
    device = "Tablet";
    DeviceIcon = Tablet;
  } else if (/mobile|iphone|ipod|android/i.test(text)) {
    device = "Mobil";
    DeviceIcon = Smartphone;
  }

  let browser = "Diğer tarayıcı";
  if (/edg\//i.test(text)) browser = "Edge";
  else if (/opr\/|opera/i.test(text)) browser = "Opera";
  else if (/samsungbrowser/i.test(text)) browser = "Samsung Internet";
  else if (/chrome|crios/i.test(text)) browser = "Chrome";
  else if (/firefox|fxios/i.test(text)) browser = "Firefox";
  else if (/safari/i.test(text)) browser = "Safari";

  return { device, browser, DeviceIcon };
}

function describeReferrer(referrer) {
  const value = String(referrer || "").trim();
  if (!value) return "Doğrudan";
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    if (hostname.includes("google.")) return "Google";
    if (hostname.includes("yandex.")) return "Yandex";
    if (hostname.includes("bing.")) return "Bing";
    return hostname;
  } catch {
    return "Yönlendirme";
  }
}

function SummaryCard({ icon, label, value, detail, color = "sky" }) {
  const colors = {
    sky: "bg-sky-50 text-sky-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>
        {icon}
      </div>
      <div className="mt-4 text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function TrendChart({ rows = [] }) {
  const maxValue = Math.max(...rows.map((row) => Math.max(row.visitors, row.pageViews)), 1);
  const compactLabels = rows.length > 16;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex h-56 min-w-[620px] items-end gap-2 border-b border-slate-200 px-1 pt-8">
        {rows.map((row, index) => (
          <div key={row.key} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
              {row.label}: {formatNumber(row.visitors)} ziyaretçi · {formatNumber(row.pageViews)} görüntüleme
            </div>
            <div className="flex h-[170px] items-end justify-center gap-1">
              <div
                className="w-2 rounded-t bg-emerald-500 transition-all group-hover:bg-emerald-600 sm:w-3"
                style={{ height: `${row.visitors ? Math.max((row.visitors / maxValue) * 100, 3) : 0}%` }}
                aria-label={`${row.label} ${row.visitors} ziyaretçi`}
              />
              <div
                className="w-2 rounded-t bg-sky-500 transition-all group-hover:bg-sky-600 sm:w-3"
                style={{ height: `${row.pageViews ? Math.max((row.pageViews / maxValue) * 100, 3) : 0}%` }}
                aria-label={`${row.label} ${row.pageViews} görüntüleme`}
              />
            </div>
            <div className="mt-2 truncate text-center text-[10px] text-slate-400">
              {!compactLabels || index % 3 === 0 ? row.label : ""}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-5 text-xs text-slate-500">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Tekil ziyaretçi</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Sayfa görüntüleme</span>
      </div>
    </div>
  );
}

function RankingList({ rows, emptyText, type }) {
  if (!rows?.length) {
    return <div className="py-10 text-center text-sm text-slate-400">{emptyText}</div>;
  }

  const maxViews = Math.max(...rows.map((row) => row.views), 1);
  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={row.pathname || row.slug}>
          <div className="flex items-start justify-between gap-4 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800">{row.label}</div>
                <div className="mt-0.5 truncate text-xs text-slate-400">
                  {type === "product" ? `/products/${row.slug}` : row.pathname}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold text-slate-800">{formatNumber(row.views)}</div>
              <div className="text-[11px] text-slate-400">{formatNumber(row.visitors)} ziyaretçi</div>
            </div>
          </div>
          <div className="ml-10 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${type === "product" ? "bg-violet-500" : "bg-sky-500"}`}
              style={{ width: `${Math.max((row.views / maxViews) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function VisitorRow({ visitor }) {
  const { device, browser, DeviceIcon } = describeUserAgent(visitor.userAgent);
  const displayId = visitor.displayId || String(visitor.visitorId || "").slice(-6).toUpperCase();

  return (
    <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition open:shadow-sm">
      <summary className="grid cursor-pointer list-none gap-4 px-5 py-4 hover:bg-slate-50 md:grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_repeat(3,minmax(80px,auto))] md:items-center">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">Anonim Ziyaretçi #{displayId}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><MapPin size={12} /> {getCountryName(visitor.country)}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><DeviceIcon size={12} /> {device} · {browser}</span>
          </div>
        </div>
        <div className="text-sm text-slate-500">
          <div className="text-xs uppercase tracking-wide text-slate-400">Son hareket</div>
          <div className="mt-1 text-slate-700">{formatDateTime(visitor.lastVisitedAt)}</div>
        </div>
        <div className="text-sm text-slate-500"><strong className="text-slate-900">{formatNumber(visitor.uniquePageCount)}</strong> sayfa</div>
        <div className="text-sm text-slate-500"><strong className="text-slate-900">{formatNumber(visitor.pageViewCount)}</strong> görüntüleme</div>
        <div className="text-sm text-slate-500"><strong className="text-slate-900">{formatNumber(visitor.sessionCount)}</strong> oturum</div>
      </summary>

      <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-5">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Dönemde ilk hareket</div>
            <div className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(visitor.firstVisitedAt)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Geliş kaynağı</div>
            <div className="mt-1 truncate text-sm font-medium text-slate-700">{describeReferrer(visitor.referrer)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Teknik ziyaretçi kimliği</div>
            <div className="mt-1 truncate font-mono text-xs text-slate-500" title={visitor.visitorId}>{visitor.visitorId}</div>
          </div>
        </div>

        <h4 className="mb-3 text-sm font-semibold text-slate-800">İncelenen sayfalar ve ürünler</h4>
        <div className="space-y-2">
          {visitor.pages.map((page) => (
            <div key={page.pathname} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={page.pathname} target="_blank" className="truncate text-sm font-semibold text-sky-700 hover:underline">
                    {page.label}
                  </Link>
                  {page.pageType === "product" ? (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">Ürün</span>
                  ) : null}
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">{page.pathname}</div>
              </div>
              <div className="shrink-0 text-xs text-slate-500">
                {formatNumber(page.viewCount)} görüntüleme · Son hareket {formatDateTime(page.lastVisitedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export default function VisitorAnalyticsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [rangeKey, setRangeKey] = useState("30d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    async function loadOverview() {
      try {
        setLoading(true);
        setError("");
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Yetkili oturumu bulunamadı.");
        const idToken = await currentUser.getIdToken();
        const result = await loadAdminAnalytics({
          idToken,
          rangeKey,
          includeDetails: true,
        });
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError?.message || "Ziyaretçi analizi yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [authLoading, rangeKey, reloadKey, user]);

  const countryOptions = useMemo(
    () => Array.from(new Set((data?.visitorDetails || []).map((visitor) => visitor.country || "BILINMIYOR"))).sort(),
    [data]
  );

  const filteredVisitors = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    const rows = (data?.visitorDetails || []).filter((visitor) => {
      const matchesCountry = country === "all" || (visitor.country || "BILINMIYOR") === country;
      const matchesSearch = !queryText ||
        String(visitor.displayId || "").toLowerCase().includes(queryText) ||
        String(visitor.visitorId || "").toLowerCase().includes(queryText);
      return matchesCountry && matchesSearch;
    });

    return [...rows].sort((a, b) => {
      if (sort === "views") return b.pageViewCount - a.pageViewCount;
      if (sort === "sessions") return b.sessionCount - a.sessionCount;
      if (sort === "pages") return b.uniquePageCount - a.uniquePageCount;
      return new Date(b.lastVisitedAt) - new Date(a.lastVisitedAt);
    });
  }, [country, data, search, sort]);

  const pageCount = Math.max(Math.ceil(filteredVisitors.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, pageCount);
  const visibleVisitors = filteredVisitors.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const summary = data?.summary || {};

  function changeRange(nextRange) {
    setRangeKey(nextRange);
    setPage(1);
  }

  function changeSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function changeCountry(value) {
    setCountry(value);
    setPage(1);
  }

  function changeSort(value) {
    setSort(value);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div>
        <Link href="/satissitok/admin" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} /> Yönetim paneline dön
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Ziyaretçi analizi</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Public ziyaret hareketleri</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Giriş yapmamış ziyaretçilerin trafik, sayfa ve ürün ilgisini inceleyin. Personel ve yetkili hesapları bu verilere dahil edilmez.
            </p>
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => changeRange(option.key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  rangeKey === option.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="inline-flex items-center gap-2 font-semibold">
            <RefreshCw size={15} /> Yeniden dene
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<Users size={20} />} label="Tekil ziyaretçi" value={loading ? "…" : formatNumber(summary.uniqueVisitors)} detail={`${formatNumber(summary.kazakhstanVisitors)} KZ · ${formatNumber(summary.otherVisitors)} diğer`} color="emerald" />
        <SummaryCard icon={<Eye size={20} />} label="Sayfa görüntüleme" value={loading ? "…" : formatNumber(summary.pageViews)} detail={`${formatNumber(summary.uniquePages)} farklı sayfa`} color="sky" />
        <SummaryCard icon={<MousePointerClick size={20} />} label="Toplam oturum" value={loading ? "…" : formatNumber(summary.sessions)} detail="Açılan anonim ziyaret oturumları" color="violet" />
        <SummaryCard icon={<MapPin size={20} />} label="KZ ziyaretçi oranı" value={loading ? "…" : `%${formatNumber(summary.kazakhstanRatio)}`} detail="Tekil ziyaretçiler içindeki pay" color="amber" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><BarChart3 size={19} className="text-cyan-600" /> Ziyaret hareketi</h2>
            <p className="mt-1 text-sm text-slate-500">{data?.range?.label || "Seçilen dönem"} içindeki ziyaretçi ve görüntüleme eğilimi</p>
          </div>
          <div className="text-xs text-slate-400">{data?.generatedAt ? `Güncellendi: ${formatDateTime(data.generatedAt)}` : ""}</div>
        </div>
        <div className="mt-5">
          {loading ? <div className="h-56 animate-pulse rounded-2xl bg-slate-100" /> : <TrendChart rows={data?.trend || []} />}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><FileText size={19} className="text-sky-600" /> En çok görüntülenen sayfalar</h2>
          <div className="mt-5">{loading ? <div className="h-48 animate-pulse rounded-2xl bg-slate-100" /> : <RankingList rows={data?.topPages} emptyText="Bu dönemde sayfa hareketi bulunmuyor." type="page" />}</div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Package size={19} className="text-violet-600" /> En çok incelenen ürünler</h2>
          <div className="mt-5">{loading ? <div className="h-48 animate-pulse rounded-2xl bg-slate-100" /> : <RankingList rows={data?.topProducts} emptyText="Bu dönemde ürün incelemesi bulunmuyor." type="product" />}</div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <Globe2 size={19} className="text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Ülkelere göre ziyaretçiler</h2>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(data?.countries || []).slice(0, 8).map((item) => (
            <div key={item.code} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="truncate text-sm font-semibold text-slate-800">{getCountryName(item.code)}</div>
              <div className="mt-1 text-xs text-slate-500">{formatNumber(item.visitors)} ziyaretçi · {formatNumber(item.sessions)} oturum</div>
            </div>
          ))}
          {!loading && !data?.countries?.length ? <div className="text-sm text-slate-400">Ülke verisi bulunmuyor.</div> : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Clock3 size={19} className="text-cyan-600" /> Ziyaretçi hareketleri</h2>
              <p className="mt-1 text-sm text-slate-500">Son 2 gündeki hareketler gösterilir. Bir ziyaretçiyi açarak incelediği sayfa ve ürünleri görebilirsiniz.</p>
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {formatNumber(filteredVisitors.length)} ziyaretçi
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_190px]">
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder="Ziyaretçi kodunda ara"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <select value={country} onChange={(event) => changeCountry(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400">
              <option value="all">Tüm ülkeler</option>
              {countryOptions.map((code) => <option key={code} value={code}>{getCountryName(code)}</option>)}
            </select>
            <select value={sort} onChange={(event) => changeSort(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400">
              <option value="recent">En son hareket</option>
              <option value="views">En çok görüntüleme</option>
              <option value="sessions">En çok oturum</option>
              <option value="pages">En çok sayfa</option>
            </select>
          </div>
        </div>

        {data?.detailRowsLimited || data?.visitorRowsLimited ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            Yoğun trafik nedeniyle seçilen dönemin en güncel kayıtları gösteriliyor.
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)
          ) : visibleVisitors.length ? (
            visibleVisitors.map((visitor) => <VisitorRow key={visitor.visitorId} visitor={visitor} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">
              Seçilen filtrelere uygun ziyaretçi bulunamadı.
            </div>
          )}
        </div>

        {!loading && filteredVisitors.length > PAGE_SIZE ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">Sayfa {safePage} / {pageCount}</div>
            <div className="flex gap-2">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft size={16} /> Önceki
              </button>
              <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(value + 1, pageCount))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                Sonraki <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
