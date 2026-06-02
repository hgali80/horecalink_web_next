"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, PlusCircle } from "lucide-react";

import { listCommercialOffers } from "@/app/satissitok/services/commercialOfferService";

function formatDate(value) {
  if (!value) return "-";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR");
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("tr-TR")} ₸`;
}

export default function CommercialOffersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const rows = await listCommercialOffers();
        if (!alive) return;
        setItems(rows);
      } catch (error) {
        console.error("Commercial offers list error:", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/satissitok/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            <ArrowLeft size={16} />
            Ana Sayfa
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Teklif Oluşturma</h1>
            <p className="text-sm text-slate-500">Admin tarafından elle oluşturulan ticari teklifler.</p>
          </div>
        </div>

        <Link
          href="/satissitok/admin/commercial-offers/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d3246] px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <PlusCircle size={16} />
          Yeni Teklif Oluştur
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Yukleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <FileText className="mx-auto mb-3 text-slate-400" />
          <div className="text-lg font-bold text-slate-800">Henüz admin teklifi yok</div>
          <div className="mt-2 text-sm text-slate-500">İlk ticari teklifi oluşturmak için yukarıdaki butonu kullan.</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/satissitok/admin/commercial-offers/${item.id}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1d3246]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-900">{item.offerNo || item.id}</div>
                  <div className="mt-1 text-sm text-slate-500">{item.buyer?.companyName || "Müşteri belirtilmedi"}</div>
                  <div className="mt-2 text-sm text-slate-500">Tarih: {formatDate(item.createdAt || item.issueDate)}</div>
                </div>
                <div className="space-y-2 text-sm md:text-right">
                  <div className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    {item.status || "draft"}
                  </div>
                  <div className="font-bold text-slate-900">{formatMoney(item.totals?.grandTotal)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
