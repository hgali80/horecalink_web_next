// app/satissitok/admin/products/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, PlusCircle, Search } from "lucide-react";
import {
  listProductsAdmin,
  updateProductFlags,
  updateProductsFlags,
} from "@/app/satissitok/services/productService";

const STATUS_FILTERS = [
  { key: "all", label: "Tum urunler" },
  { key: "active", label: "Aktif" },
  { key: "passive", label: "Pasif" },
  { key: "web", label: "Webde" },
  { key: "not_web", label: "Webde degil" },
];

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";
const PLACEHOLDER_IMAGE = "/Placeholder.png";

function toStr(x) {
  return (x ?? "").toString();
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

function getProductImageUrl(product) {
  const imageNames = Array.isArray(product?.image_names)
    ? product.image_names.filter(Boolean)
    : [];
  const imageName =
    imageNames[0] ||
    cleanText(product?.imageBase ? `${product.imageBase}` : "");

  if (!imageName) return null;

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(
    /\.[a-z0-9]+$/i.test(imageName) ? imageName : `${imageName}.jpg`
  )}?alt=media`;
}

function ProductThumb({ product, alt }) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getProductImageUrl(product);
  const src = !imageError && imageUrl ? imageUrl : PLACEHOLDER_IMAGE;

  return (
    <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        onError={() => setImageError(true)}
        className="object-contain p-1"
      />
    </div>
  );
}

export default function AdminProductsPage() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [busyMap, setBusyMap] = useState({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState("");

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

  const visibleIds = useMemo(() => filtered.map((item) => item.id).filter(Boolean), [filtered]);
  const selectedCount = selectedIds.length;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleSelected(productId) {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function patchItems(ids, patch) {
    const idSet = new Set(ids);
    setItems((current) =>
      current.map((item) => (idSet.has(item.id) ? { ...item, ...patch } : item))
    );
  }

  async function handleSingleToggle(productId, field, value) {
    setErr("");
    setNotice("");
    setBusyMap((current) => ({ ...current, [productId]: true }));

    try {
      await updateProductFlags(productId, { [field]: value });
      patchItems([productId], { [field]: value });
      setNotice(`Ürün güncellendi: ${productId}`);
    } catch (e) {
      setErr(e?.message || "Ürün durumu güncellenemedi.");
    } finally {
      setBusyMap((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
    }
  }

  async function handleBulkToggle(field, value) {
    if (!selectedIds.length) return;

    setErr("");
    setNotice("");
    setBulkBusy(true);

    try {
      const updatedIds = await updateProductsFlags(selectedIds, { [field]: value });
      patchItems(updatedIds, { [field]: value });
      setNotice(`${updatedIds.length} ürün güncellendi.`);
    } catch (e) {
      setErr(e?.message || "Toplu güncelleme başarısız.");
    } finally {
      setBulkBusy(false);
    }
  }

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

      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

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

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">{selectedCount}</span> ürün seçili
                {visibleIds.length ? ` • görünür listede ${visibleIds.length} ürün var` : ""}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {allVisibleSelected ? "Görünür seçimleri kaldır" : "Görünür listedekileri seç"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  disabled={!selectedCount || bulkBusy}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Seçimi temizle
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggle("active", true)}
                  disabled={!selectedCount || bulkBusy}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Seçiliyi aktif yap
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggle("active", false)}
                  disabled={!selectedCount || bulkBusy}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Seçiliyi pasif yap
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggle("webPublished", true)}
                  disabled={!selectedCount || bulkBusy}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Seçiliyi webe al
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggle("webPublished", false)}
                  disabled={!selectedCount || bulkBusy}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  Seçiliyi webden kaldır
                </button>
              </div>
            </div>
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
            <div className="col-span-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                aria-label="Gorunur listedeki urunleri sec"
              />
              <span>Sec</span>
            </div>
            <div className="col-span-1">Foto</div>
            <div className="col-span-2">Stok Kodu</div>
            <div className="col-span-3">Urun</div>
            <div className="col-span-2">Kategori</div>
            <div className="col-span-1 text-center">Web</div>
            <div className="col-span-1 text-center">Aktif</div>
            <div className="col-span-1 text-right">Fiyat</div>
          </div>

          {filtered.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-12 items-center gap-2 border-t px-3 py-2 text-sm hover:bg-gray-50"
            >
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleSelected(p.id)}
                  aria-label={`${toStr(p.stock_code)} urununu sec`}
                />
              </div>

              <div className="col-span-1">
                <ProductThumb product={p} alt={toStr(p.name) || toStr(p.name_tr) || "Urun"} />
              </div>

              <div className="col-span-2 font-mono">{toStr(p.stock_code)}</div>

              <div className="col-span-3">
                <Link
                  href={`/satissitok/admin/products/${p.id}`}
                  className="font-medium text-gray-900 hover:underline"
                >
                  {toStr(p.name)}
                </Link>
                <div className="text-xs text-gray-500">{toStr(p.name_tr)}</div>
              </div>

              <div className="col-span-2 text-xs text-gray-700">
                {toStr(p.main_category)}
                <div className="text-gray-500">{toStr(p.sub_category)}</div>
              </div>

              <div className="col-span-1 flex justify-center">
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={p.webPublished === true}
                    disabled={busyMap[p.id] || bulkBusy}
                    onChange={(e) => handleSingleToggle(p.id, "webPublished", e.target.checked)}
                    aria-label={`${toStr(p.stock_code)} web durumu`}
                  />
                </label>
              </div>

              <div className="col-span-1 flex justify-center">
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={p.active === true}
                    disabled={busyMap[p.id] || bulkBusy}
                    onChange={(e) => handleSingleToggle(p.id, "active", e.target.checked)}
                    aria-label={`${toStr(p.stock_code)} aktif durumu`}
                  />
                </label>
              </div>

              <div className="col-span-1 text-right font-medium">
                {Number(p.price || 0).toLocaleString("tr-TR")}
              </div>
            </div>
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
