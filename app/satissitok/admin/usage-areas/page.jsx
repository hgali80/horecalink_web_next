"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Grid3X3,
  Home,
  PlusCircle,
  Search,
  Trash2,
} from "lucide-react";

import {
  createUsageArea,
  deleteUsageArea,
  listUsageAreasEnsured,
} from "@/app/satissitok/services/usageAreaService";

function toStr(value) {
  return (value ?? "").toString().trim();
}

export default function AdminUsageAreasPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const list = await listUsageAreasEnsured();
      setItems(list);
    } catch (err) {
      setError(err?.message || "Kullanim alanlari yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    try {
      setWorking(true);
      const nextOrder =
        items.reduce((max, item) => Math.max(max, Number(item.order || 0)), 0) + 1;
      const id = await createUsageArea({
        name_tr: "Yeni Kullanim Alani",
        name_kz: "Жаңа қолдану саласы",
        name_ru: "Новая сфера применения",
        name_en: "New usage area",
        description_tr: "",
        description_kz: "",
        description_ru: "",
        description_en: "",
        isActive: true,
        showOnHome: true,
        order: nextOrder,
        productIds: [],
      });
      router.push(`/satissitok/admin/usage-areas/${id}`);
    } catch (err) {
      alert(err?.message || "Yeni kullanim alani olusturulamadi.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("Bu kullanim alani silinsin mi?");
    if (!ok) return;

    try {
      setWorking(true);
      await deleteUsageArea(id);
      await load();
    } catch (err) {
      alert(err?.message || "Kullanim alani silinemedi.");
    } finally {
      setWorking(false);
    }
  }

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => {
      const haystack = [
        item.slug,
        item.name_tr,
        item.name_kz,
        item.name_ru,
        item.name_en,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kullanim Alanlari</h1>
          <p className="mt-1 text-sm text-slate-500">
            Alan olustur, gorsel ekle, urunleri ata.
          </p>
        </div>

        <button
          type="button"
          disabled={working}
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-60"
        >
          <PlusCircle className="h-4 w-4" />
          Yeni Kullanim Alani
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
        <Search className="h-4 w-4 text-gray-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ara: slug veya kullanim alani adi..."
          className="w-full text-sm outline-none"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Yukleniyor...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Grid3X3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-slate-900">
                      {item.name_tr || item.name_ru || item.slug}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.slug}</div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={working || items.length <= 1}
                  onClick={() => handleDelete(item.id)}
                  className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <InfoCard label="Sira" value={item.order} />
                <InfoCard label="Ana Sayfa" value={item.showOnHome ? "Evet" : "Hayir"} />
                <InfoCard label="Urun" value={item.productIds.length} />
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.isActive ? "Aktif" : "Pasif"}
                </span>

                <Link
                  href={`/satissitok/admin/usage-areas/${item.id}`}
                  className="text-sm font-semibold text-[#1d3246] hover:underline"
                >
                  Duzenle
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}
