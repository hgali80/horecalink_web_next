// app/satissitok/admin/products/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, PlusCircle, Search } from "lucide-react";
import { listProductsAdmin } from "@/app/satissitok/services/productService";

const STATUS_FILTERS = [
  { key: "all", label: "Tum urunler" },
  { key: "active", label: "Aktif" },
  { key: "passive", label: "Pasif" },
  { key: "web", label: "Webde" },
  { key: "not_web", label: "Webde degil" },
];

function toStr(x) {
  return (x ?? "").toString();
}

export default function AdminProductsPage() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const list = await listProductsAdmin();
        if (!alive) return;
        setItems(list);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Urunler yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return items.filter((p) => {
      if (statusFilter === "active" && p.active !== true) return false;
      if (statusFilter === "passive" && p.active !== false) return false;
      if (statusFilter === "web" && p.webPublished !== true) return false;
      if (statusFilter === "not_web" && p.webPublished !== false) return false;

      if (!s) return true;

      const hay = [
        p.stock_code,
        p.name,
        p.name_tr,
        p.barcode,
        p.main_category,
        p.sub_category,
        p.brand,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [items, q, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((item) => item.active === true).length,
      passive: items.filter((item) => item.active === false).length,
      web: items.filter((item) => item.webPublished === true).length,
      notWeb: items.filter((item) => item.webPublished === false).length,
      visible: filtered.length,
    };
  }, [filtered.length, items]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Geri"
          title="Geri"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Satis/Stok Ana Sayfa"
          title="Satis/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Urunler</h1>

        <Link
          href="/satissitok/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900"
        >
          <PlusCircle className="w-4 h-4" />
          Yeni Urun
        </Link>
      </div>

      <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
        <Search className="w-4 h-4 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara: stok kodu, isim, barkod, kategori..."
          className="w-full outline-none text-sm"
        />
      </div>

      {!loading && !err ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <SummaryCard label="Toplam" value={stats.total} tone="slate" />
            <SummaryCard label="Aktif" value={stats.active} tone="green" />
            <SummaryCard label="Pasif" value={stats.passive} tone="red" />
            <SummaryCard label="Webde" value={stats.web} tone="blue" />
            <SummaryCard label="Webde Degil" value={stats.notWeb} tone="amber" />
            <SummaryCard label="Listelenen" value={stats.visible} tone="slate" />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const active = statusFilter === filter.key;

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-[#1d3246] bg-[#1d3246] text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-600">Yukleniyor...</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-700 px-3 py-2">
            <div className="col-span-2">Stok Kodu</div>
            <div className="col-span-5">Urun</div>
            <div className="col-span-2">Kategori</div>
            <div className="col-span-1 text-center">Web</div>
            <div className="col-span-1 text-center">Aktif</div>
            <div className="col-span-1 text-right">Fiyat</div>
          </div>

          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/satissitok/admin/products/${p.id}`}
              className="grid grid-cols-12 px-3 py-2 text-sm border-t hover:bg-gray-50"
            >
              <div className="col-span-2 font-mono">{toStr(p.stock_code)}</div>

              <div className="col-span-5">
                <div className="font-medium text-gray-900">{toStr(p.name)}</div>
                <div className="text-xs text-gray-500">{toStr(p.name_tr)}</div>
              </div>

              <div className="col-span-2 text-xs text-gray-700">
                {toStr(p.main_category)}
                <div className="text-gray-500">{toStr(p.sub_category)}</div>
              </div>

              <div className="col-span-1 text-center text-xs">
                {p.webPublished ? "✓" : "—"}
              </div>

              <div className="col-span-1 text-center text-xs">
                {p.active ? "✓" : "⛔"}
              </div>

              <div className="col-span-1 text-right font-medium">
                {Number(p.price || 0).toLocaleString("tr-TR")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
