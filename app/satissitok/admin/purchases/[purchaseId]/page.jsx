"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import {
  ArrowLeft,
  Calendar,
  Hash,
  Home,
  Layers,
  Printer,
  Trash2,
} from "lucide-react";
import { cancelPurchase } from "@/app/satissitok/services/purchaseService";
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
  if (value?.toDate) return value.toDate().toLocaleDateString("tr-TR");
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt.toLocaleDateString("tr-TR");
  return "-";
}

function formatDateTime(value) {
  if (!value) return "-";
  if (value?.toDate) return value.toDate().toLocaleString("tr-TR");
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt.toLocaleString("tr-TR");
  return "-";
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getSettlementSummary(purchase, computedTotals) {
  const invoiceAmount = Number(purchase?.grossTotal ?? purchase?.totals?.gross ?? computedTotals?.gross ?? 0) || 0;
  const summary = purchase?.settlementSummary || {};
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
    blue: "border-blue-200 bg-blue-50 text-blue-800",
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

export default function PurchaseDetailPage() {
  const { purchaseId } = useParams();
  const router = useRouter();

  const [purchase, setPurchase] = useState(null);
  const [items, setItems] = useState([]);
  const [settlementRows, setSettlementRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function reload() {
    if (!purchaseId) return;

    setLoading(true);
    try {
      const ref = doc(db, "purchases", purchaseId);
      const [snap, itemsSnap, settlementData] = await Promise.all([
        getDoc(ref),
        getDocs(collection(db, "purchases", purchaseId, "items")),
        listDocumentSettlementsByInvoice({ kind: "purchase", invoiceId: purchaseId }),
      ]);

      if (!snap.exists()) {
        setPurchase(null);
        setItems([]);
        setSettlementRows([]);
        return;
      }

      const data = snap.data();
      setPurchase({ id: purchaseId, ...data });
      const subItems = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(subItems.length > 0 ? subItems : data.items || []);
      setSettlementRows(settlementData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  const computedTotals = useMemo(() => {
    const docNet = purchase?.totals?.net ?? purchase?.netTotal;
    const docVat = purchase?.totals?.tax ?? purchase?.vatTotal;
    const docGross = purchase?.totals?.gross ?? purchase?.grossTotal;

    if (docNet != null || docVat != null || docGross != null) {
      return {
        net: Number(docNet || 0),
        vat: Number(docVat || 0),
        gross: Number(docGross || 0),
      };
    }

    const net = items.reduce((sum, item) => sum + Number(item.netLineTotal ?? item.net ?? 0), 0);
    const vat = items.reduce((sum, item) => sum + Number(item.vatLineTotal ?? item.vat ?? 0), 0);
    const gross = items.reduce((sum, item) => sum + Number(item.grossLineTotal ?? item.total ?? 0), 0);

    return {
      net: Math.round(net * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      gross: Math.round(gross * 100) / 100,
    };
  }, [purchase, items]);

  async function handleCancel() {
    if (!purchaseId || !purchase || normalizeStatus(purchase.status) === "cancelled") return;

    const ok = confirm(
      "Bu satinalmayi iptal etmek istiyor musunuz?\nBu islem belgeyi iptal durumuna alir."
    );
    if (!ok) return;

    setWorking(true);
    try {
      await cancelPurchase({ purchaseId });
      await reload();
    } catch (error) {
      alert(error?.message || "Satinalma iptal edilirken hata olustu");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!purchase) {
    return <div className="max-w-5xl mx-auto p-12 text-center text-gray-500">Satinalma kaydi bulunamadi.</div>;
  }

  const normalizedStatus = normalizeStatus(purchase.status);
  const settlementSummary = getSettlementSummary(purchase, computedTotals);
  const supplierTitle = purchase.supplierName || purchase.supplierTitle || "-";

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
            {purchase.invoiceNo || "Fatura No Yok"}
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

          {normalizedStatus !== "cancelled" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition-all hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={16} />
              <span>{working ? "Iptal ediliyor..." : "Satinalmayi Iptal Et"}</span>
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
                <span>{formatDate(purchase.documentDate || purchase.invoiceDate)}</span>
                <Hash size={14} className="ml-2" />
                <span>ID: {String(purchase.id).slice(-6).toUpperCase()}</span>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tedarikci</p>
                <p className="font-semibold text-indigo-600">{supplierTitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-right">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Satinalma Turu</p>
                <p className="font-semibold text-gray-700">{purchase.purchaseType === "official" ? "Resmi" : "Fiili"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cari Kodu</p>
                <p className="font-semibold text-gray-700">{purchase.supplierCariId || "-"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryCard title="Belge Tutari" value={`${formatMoney(settlementSummary.invoiceAmount)} KZT`} />
            <SummaryCard title="Odenen" value={`${formatMoney(settlementSummary.settledAmount)} KZT`} tone="blue" />
            <SummaryCard title="Acik Tutar" value={`${formatMoney(settlementSummary.outstandingAmount)} KZT`} tone="amber" />
            <SummaryCard title="Kapanis Durumu" value={settlementLabel(settlementSummary.status)} tone="indigo" />
          </div>

          <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Settlement Hareketleri</h2>
              <p className="mt-1 text-xs text-slate-500">Bu belgeye bagli odeme satirlari burada listelenir.</p>
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
                      <td className="px-3 py-2 text-right font-medium text-blue-700">{formatMoney(row.amount)} KZT</td>
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

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="pb-3 text-left">Urun Detayi</th>
                  <th className="px-4 pb-3 text-center">Birim / Miktar</th>
                  <th className="px-4 pb-3 text-right">Birim Fiyat</th>
                  <th className="px-4 pb-3 text-right">Net Tutar</th>
                  <th className="px-4 pb-3 text-right">KDV</th>
                  <th className="pb-3 pl-4 text-right">Genel Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => {
                  const productName = item.productName || item.name || item.title || "-";
                  const quantity = Number(item.quantity || item.qty || 0);
                  const unit = item.unit || item.unitName || "-";
                  const unitPrice = Number(item.unitPrice || item.price || 0);
                  const net = Number(item.netLineTotal ?? item.net ?? 0);
                  const vat = Number(item.vatLineTotal ?? item.vat ?? 0);
                  const gross = Number(item.grossLineTotal ?? item.total ?? 0);

                  return (
                    <tr key={item.id || `${item.productId}-${productName}`} className="transition-colors hover:bg-gray-50/50">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
                            <Layers size={14} />
                          </div>
                          <span className="line-clamp-2 text-sm font-semibold text-gray-800">{productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-600">{quantity}</span>
                          <span className="text-[10px] uppercase text-gray-400">{unit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-sm text-gray-600">{formatMoney(unitPrice)}</td>
                      <td className="px-4 py-4 text-right font-mono text-sm text-gray-600">{formatMoney(net)}</td>
                      <td className="px-4 py-4 text-right font-mono text-sm text-gray-500">{formatMoney(vat)}</td>
                      <td className="py-4 pl-4 text-right font-mono text-sm font-bold text-gray-900">{formatMoney(gross)}</td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
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
              <span className="font-mono text-gray-700">{formatMoney(computedTotals.net)} KZT</span>
            </div>

            <div className="flex w-full items-center justify-between border-b border-gray-200 pb-3 text-sm md:w-80">
              <span className="text-gray-500">Toplam KDV</span>
              <span className="font-mono text-gray-700">{formatMoney(computedTotals.vat)} KZT</span>
            </div>

            <div className="flex w-full items-center justify-between gap-4 pt-2 md:w-80">
              <span className="whitespace-nowrap text-lg font-bold uppercase text-gray-900">Genel Toplam</span>
              <span className="whitespace-nowrap font-mono text-2xl font-bold tracking-tighter text-indigo-600">
                {formatMoney(computedTotals.gross)} <span className="ml-1 text-sm">KZT</span>
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
