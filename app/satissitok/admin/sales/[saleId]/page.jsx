"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  FileDown,
  Hash,
  Home,
  Layers,
  Phone,
  Printer,
  Trash2,
  User,
} from "lucide-react";
import { cancelSale } from "@/app/satissitok/services/saleService";
import { listDocumentSettlementsByInvoice } from "@/app/satissitok/services/documentSettlementService";

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "completed") return "confirmed";
  if (value === "pending") return "draft";
  if (value === "returned") return "cancelled";
  return value || "draft";
}

function formatDate(value) {
  if (!value) return "-";
  const dt = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("tr-TR");
}

function formatDateTime(value) {
  if (!value) return "-";
  const dt = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("tr-TR");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getSettlementSummary(sale) {
  const invoiceAmount = Number(sale?.grossTotal || 0) || 0;
  const summary = sale?.settlementSummary || {};
  const settledAmount = Number(summary.settledAmount || 0) || 0;
  const outstandingAmount =
    Number(summary.outstandingAmount ?? Math.max(invoiceAmount - settledAmount, 0)) || 0;
  const status =
    summary.status || (outstandingAmount <= 0 ? "closed" : settledAmount > 0 ? "partial" : "open");

  return { invoiceAmount, settledAmount, outstandingAmount, status };
}

function settlementLabel(status) {
  if (status === "closed") return "Kapali";
  if (status === "partial") return "Kismi";
  return "Acik";
}

function StatusBadge({ status }) {
  const tone =
    status === "cancelled"
      ? "bg-red-100 text-red-700 border-red-200"
      : status === "draft"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-emerald-100 text-emerald-700 border-emerald-200";

  const label = status === "cancelled" ? "Iptal" : status === "draft" ? "Taslak" : "Onayli";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${tone}`}>
      {label}
    </span>
  );
}

function SettlementBadge({ status }) {
  const tone =
    status === "closed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "partial"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${tone}`}>
      {settlementLabel(status)}
    </span>
  );
}

function SummaryCard({ title, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{title}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

export default function SaleDetailPage() {
  const { saleId } = useParams();
  const router = useRouter();

  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [cari, setCari] = useState(null);
  const [settlementRows, setSettlementRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function loadSaleData() {
    if (!saleId) return;

    setLoading(true);
    try {
      const saleRef = doc(db, "sales", saleId);
      const [saleSnap, itemsSnap, settlementData] = await Promise.all([
        getDoc(saleRef),
        getDocs(collection(db, "sales", saleId, "items")),
        listDocumentSettlementsByInvoice({ kind: "sale", invoiceId: saleId }),
      ]);

      if (!saleSnap.exists()) {
        setSale(null);
        setItems([]);
        setCari(null);
        setSettlementRows([]);
        return;
      }

      const saleData = { id: saleId, ...saleSnap.data() };
      setSale(saleData);
      setSettlementRows(settlementData);

      const subItems = itemsSnap.docs.map((row) => ({ id: row.id, ...row.data() }));
      setItems(subItems.length > 0 ? subItems : saleData.items || []);

      const cariId = saleData?.cariId || saleData?.customerId || saleData?.cari?.id;
      if (!cariId) {
        const fallbackName =
          saleData?.cariName ||
          saleData?.customerName ||
          saleData?.customerTitle ||
          saleData?.companyName ||
          null;
        setCari(fallbackName ? { id: null, name: fallbackName } : null);
        return;
      }

      try {
        const cariSnap = await getDoc(doc(db, "caris", String(cariId)));
        if (cariSnap.exists()) {
          setCari({ id: cariSnap.id, ...cariSnap.data() });
        } else {
          setCari({
            id: String(cariId),
            name:
              saleData?.cariName ||
              saleData?.customerName ||
              saleData?.customerTitle ||
              saleData?.companyName ||
              "-",
          });
        }
      } catch {
        setCari({
          id: String(cariId),
          name:
            saleData?.cariName ||
            saleData?.customerName ||
            saleData?.customerTitle ||
            saleData?.companyName ||
            "-",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSaleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  async function handleCancelSale() {
    if (!sale || normalizeStatus(sale.status) !== "confirmed") return;

    const ok = confirm(
      "Bu satisi iptal etmek istiyor musunuz?\nStoklar otomatik olarak geri eklenecektir."
    );
    if (!ok) return;

    setWorking(true);
    try {
      await cancelSale({ saleId });
      await loadSaleData();
    } catch (error) {
      alert(error?.message || "Satis iptal edilirken hata olustu");
    } finally {
      setWorking(false);
    }
  }

  const normalizedStatus = normalizeStatus(sale?.status);
  const settlementSummary = getSettlementSummary(sale);
  const saleDate = sale?.documentDate || sale?.invoiceDate || sale?.createdAt || null;
  const isOfficial = sale?.saleType === "official";
  const visibleItems = useMemo(() => items || [], [items]);

  const cariTitle =
    cari?.firm ||
    cari?.title ||
    cari?.name ||
    cari?.unvan ||
    cari?.companyName ||
    sale?.cariTitle ||
    sale?.cariName ||
    sale?.customerName ||
    sale?.customerTitle ||
    sale?.companyName ||
    "-";

  const cariPhone = cari?.phone || cari?.tel || cari?.mobile || sale?.customerPhone || sale?.phone || null;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!sale) {
    return <div className="max-w-5xl mx-auto p-12 text-center text-gray-500">Satis kaydi bulunamadi.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {sale.invoiceNo || "Fatura No Yok"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={normalizedStatus} />
            <SettlementBadge status={settlementSummary.status} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50"
          >
            <Printer size={18} />
            <span className="text-sm font-semibold">Yazdir</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50"
          >
            <FileDown size={18} />
            <span className="text-sm font-semibold">PDF</span>
          </button>

          {normalizedStatus === "confirmed" && (
            <button
              type="button"
              onClick={handleCancelSale}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition-all hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={16} />
              <span>{working ? "Iptal ediliyor..." : "Satisi Iptal Et"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="space-y-6 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar size={14} />
                <span>{formatDate(saleDate)}</span>
                <Hash size={14} className="ml-2" />
                <span>ID: {String(sale.id).slice(-6).toUpperCase()}</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <Building2 size={14} /> Musteri:
                  </span>
                  {cari?.id ? (
                    <Link href={`/satissitok/admin/cari/${cari.id}`} className="font-semibold text-indigo-700 hover:underline">
                      {cariTitle}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 font-semibold text-gray-800">
                      <User size={14} className="text-gray-400" />
                      {cariTitle}
                    </span>
                  )}
                </div>

                {cariPhone && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone size={13} />
                    <span className="font-medium">{cariPhone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-right">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Satis Turu</p>
                <p className="font-semibold text-gray-700">{isOfficial ? "Resmi" : "Fiili"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Kanal / Platform</p>
                <p className="font-semibold uppercase italic text-indigo-600">{sale.saleChannel || "-"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryCard title="Belge Tutari" value={`${formatMoney(settlementSummary.invoiceAmount)} KZT`} />
            <SummaryCard title="Tahsil Edilen" value={`${formatMoney(settlementSummary.settledAmount)} KZT`} tone="emerald" />
            <SummaryCard title="Acik Tutar" value={`${formatMoney(settlementSummary.outstandingAmount)} KZT`} tone="amber" />
            <SummaryCard title="Kapanis Durumu" value={settlementLabel(settlementSummary.status)} tone="indigo" />
          </div>

          <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Settlement Hareketleri</h2>
              <p className="mt-1 text-xs text-slate-500">Bu belgeye bagli tahsilat satirlari burada listelenir.</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Tarih</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Makbuz</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Yontem</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Tutar</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Aciklama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {settlementRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-gray-600">{formatDateTime(row.operationDate)}</td>
                      <td className="px-3 py-2 text-gray-700">{row.receiptNo || "-"}</td>
                      <td className="px-3 py-2 text-gray-700">{row.method || "-"}</td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-700">{formatMoney(row.amount)} KZT</td>
                      <td className="px-3 py-2 text-gray-500">{row.description || "-"}</td>
                    </tr>
                  ))}

                  {settlementRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                        Bu belgeye bagli settlement hareketi bulunamadi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {sale.hasNegativeStock && (
            <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase text-amber-800">Kritik Stok Uyarisi</h3>
                <p className="mt-1 text-sm italic text-amber-700">
                  Bu satis sirasinda asagidaki urunler eksiye dusmustur:
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                  {(sale.negativeStockItems || []).map((row, index) => (
                    <div
                      key={`${row.productId || "product"}-${index}`}
                      className="flex justify-between rounded border border-amber-100 bg-white/50 p-2"
                    >
                      <span className="font-medium text-gray-700">{row.productId}</span>
                      <span className="text-red-600">
                        Mevcut: {row.available} / Satilan: {row.sold}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="pb-3 text-left">Urun Detayi</th>
                  <th className="px-4 pb-3 text-center">Birim / Miktar</th>
                  <th className="px-4 pb-3 text-right">Birim Fiyat</th>
                  <th className="px-4 pb-3 text-right">Net Tutar</th>
                  {isOfficial && <th className="px-4 pb-3 text-right">KDV</th>}
                  <th className="pb-3 pl-4 text-right">Genel Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleItems.map((item) => (
                  <tr key={item.id || `${item.productId}-${item.productName}`} className="transition-colors hover:bg-gray-50/50">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
                          <Layers size={14} />
                        </div>
                        <div className="min-w-0">
                          <span className="block line-clamp-2 text-sm font-semibold text-gray-800">
                            {item.productName || item.name || "-"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-600">{item.quantity || 0}</span>
                        <span className="text-[10px] uppercase text-gray-400">{item.unit || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-gray-600">
                      {formatMoney(item.unitPrice || 0)}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-gray-600">
                      {formatMoney(item.net || item.netLineTotal || 0)}
                    </td>
                    {isOfficial && (
                      <td className="px-4 py-4 text-right font-mono text-sm text-gray-500">
                        {formatMoney(item.vat || item.vatLineTotal || 0)}
                      </td>
                    )}
                    <td className="py-4 pl-4 text-right font-mono text-sm font-bold text-gray-900">
                      {formatMoney(item.total || item.grossLineTotal || 0)}
                    </td>
                  </tr>
                ))}

                {visibleItems.length === 0 && (
                  <tr>
                    <td colSpan={isOfficial ? 6 : 5} className="py-10 text-center text-gray-400">
                      Urun kalemi bulunamadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 p-6 md:p-8">
          <div className="flex flex-col items-end gap-3">
            <div className="flex w-full items-center justify-between text-sm md:w-80">
              <span className="text-gray-500">Ara Toplam (Net)</span>
              <span className="font-mono text-gray-700">{formatMoney(sale.netTotal || 0)} KZT</span>
            </div>

            {isOfficial && (
              <div className="flex w-full items-center justify-between border-b border-gray-200 pb-3 text-sm md:w-80">
                <span className="text-gray-500">Toplam KDV</span>
                <span className="font-mono text-gray-700">{formatMoney(sale.vatTotal || 0)} KZT</span>
              </div>
            )}

            <div className="flex w-full items-center justify-between gap-4 pt-2 md:w-80">
              <span className="whitespace-nowrap text-lg font-bold uppercase text-gray-900">Genel Toplam</span>
              <span className="whitespace-nowrap font-mono text-2xl font-bold tracking-tighter text-indigo-600">
                {formatMoney(sale.grossTotal || 0)} <span className="ml-1 text-sm">KZT</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] uppercase tracking-widest text-gray-400">
        Bu belge sistem tarafindan otomatik olusturulmustur.
      </div>
    </div>
  );
}
