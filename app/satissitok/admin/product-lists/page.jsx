"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, PlusCircle } from "lucide-react";
import { calculateProductListTotal, listProductLists } from "@/app/satissitok/services/productListService";

function formatDate(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("tr-TR");
}

function money(value, currency = "KZT") {
  const symbols = { KZT: "₸", TRY: "TL", USD: "$", EUR: "€" };
  return `${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbols[currency] || currency}`;
}

export default function ProductListsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listProductLists()
      .then((rows) => alive && setItems(rows))
      .catch((err) => {
        console.error("Product lists load error:", err);
        if (alive) setError("Ürün listeleri yüklenemedi. Firestore kurallarını kontrol et.");
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/satissitok/admin" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"><ArrowLeft size={16} /> Ana Sayfa</Link>
          <div><h1 className="text-2xl font-bold text-slate-900">Spisok Tovar</h1><p className="text-sm text-slate-500">Müşteriye özel, miktarlı ve toplamlı ürün listeleri.</p></div>
        </div>
        <Link href="/satissitok/admin/product-lists/new" className="inline-flex items-center gap-2 rounded-xl bg-[#1d3246] px-4 py-2 text-sm font-semibold text-white shadow-sm"><PlusCircle size={16} /> Yeni Liste</Link>
      </div>
      {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Yükleniyor...</div> : error ? null : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><ClipboardList className="mx-auto mb-3 text-slate-400" /><div className="text-lg font-bold text-slate-800">Henüz ürün listesi yok</div><div className="mt-2 text-sm text-slate-500">İlk listeyi oluşturmak için “Yeni Liste” butonunu kullan.</div></div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Link key={item.id} href={`/satissitok/admin/product-lists/${item.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1d3246]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-lg font-bold text-slate-900">{item.title || "Adsız liste"}</div><div className="mt-1 text-sm text-slate-500">{item.customerName || "Müşteri belirtilmemiş"} · {item.items?.length || 0} ürün · {formatDate(item.updatedAt || item.createdAt)}</div></div><div className="flex flex-wrap items-center gap-3"><strong className="text-sm text-slate-900">{money(calculateProductListTotal(item.items), item.currency)}</strong><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{item.status === "ready" ? "Hazır" : "Taslak"}</span></div></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
