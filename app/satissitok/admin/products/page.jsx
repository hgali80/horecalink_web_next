// app/satissitok/admin/products/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Home, PlusCircle, Search } from "lucide-react";
import { listProductsAdmin } from "@/app/satissitok/services/productService";

function toStr(x) {
  return (x ?? "").toString();
}

export default function AdminProductsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
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
        setErr(e?.message || "Ürünler yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) => {
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
  }, [items, q]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Geri
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <Home className="w-4 h-4" /> Ana Sayfa
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Ürünler</h1>

        <Link
          href="/satissitok/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900"
        >
          <PlusCircle className="w-4 h-4" /> Yeni Ürün
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

      {loading ? (
        <div className="text-sm text-gray-600">Yükleniyor...</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-700 px-3 py-2">
            <div className="col-span-2">Stok Kodu</div>
            <div className="col-span-5">Ürün</div>
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
                {p.webPublished ? "✅" : "—"}
              </div>
              <div className="col-span-1 text-center text-xs">
                {p.active ? "✅" : "⛔"}
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