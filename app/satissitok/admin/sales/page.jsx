"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Calendar,
  CreditCard,
  ChevronRight,
  ArrowLeft,
  Home,
} from "lucide-react";

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "completed") return "confirmed";
  if (value === "pending") return "draft";
  if (value === "returned") return "cancelled";
  return value || "draft";
}

function getSettlementSummary(row) {
  const invoiceAmount = Number(row?.grossTotal || 0) || 0;
  const summary = row?.settlementSummary || {};
  const settledAmount = Number(summary.settledAmount || 0) || 0;
  const outstandingAmount =
    Number(summary.outstandingAmount ?? Math.max(invoiceAmount - settledAmount, 0)) || 0;
  const status =
    summary.status || (outstandingAmount <= 0 ? "closed" : settledAmount > 0 ? "partial" : "open");

  return { invoiceAmount, settledAmount, outstandingAmount, status };
}

function getSettlementLabel(status) {
  if (status === "closed") return "Kapali";
  if (status === "partial") return "Kismi";
  return "Acik";
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  if (value?.toDate) return value.toDate().toLocaleDateString("tr-TR");
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt.toLocaleDateString("tr-TR");
  return "-";
}

function SettlementBadge({ status }) {
  const tone =
    status === "closed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "partial"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {getSettlementLabel(status)}
    </span>
  );
}

export default function SalesListPage() {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [caris, setCaris] = useState({});
  const [loading, setLoading] = useState(true);

  const [saleType, setSaleType] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [status, setStatus] = useState("");
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let salesQuery = query(collection(db, "sales"), orderBy("createdAt", "desc"));
        if (saleType) salesQuery = query(salesQuery, where("saleType", "==", saleType));
        if (platformId) salesQuery = query(salesQuery, where("saleChannel", "==", platformId));

        const [saleSnap, cariSnap] = await Promise.all([
          getDocs(salesQuery),
          getDocs(collection(db, "caris")),
        ]);

        const saleData = saleSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        const cariMap = {};
        cariSnap.docs.forEach((docSnap) => {
          cariMap[docSnap.id] = docSnap.data().firm || docSnap.data().name || "Isimsiz Cari";
        });

        setRows(saleData);
        setCaris(cariMap);
      } catch (error) {
        console.error("Satis listesi yukleme hatasi:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [platformId, saleType]);

  const filteredRows = useMemo(() => {
    const q = String(searchQ || "").trim().toLowerCase();

    return rows.filter((row) => {
      const normalizedStatus = normalizeStatus(row.status);
      if (status && normalizedStatus !== status) return false;

      if (!q) return true;

      const cariName = String(caris[row.cariId] || "").toLowerCase();
      const invoiceNo = String(row.invoiceNo || "").toLowerCase();
      const draftNo = String(row.draftNo || "").toLowerCase();
      const platform = String(row.saleChannel || row.platformId || "").toLowerCase();

      return (
        cariName.includes(q) ||
        invoiceNo.includes(q) ||
        draftNo.includes(q) ||
        platform.includes(q)
      );
    });
  }, [caris, rows, searchQ, status]);

  function getRowHref(row) {
    if (normalizeStatus(row.status) === "draft") {
      return `/satissitok/admin/sales/new?draftId=${row.id}`;
    }
    return `/satissitok/admin/sales/${row.id}`;
  }

  function getStatusBadge(row) {
    const normalizedStatus = normalizeStatus(row.status);
    if (normalizedStatus === "draft") {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
          Taslak
        </span>
      );
    }

    if (normalizedStatus === "cancelled") {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
          {String(row.status || "").toLowerCase() === "returned" ? "Iade" : "Iptal"}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
        Onayli
      </span>
    );
  }

  function getRowStyle(row) {
    const normalizedStatus = normalizeStatus(row.status);
    if (normalizedStatus === "draft") return "bg-amber-50/70 hover:bg-amber-50";
    if (normalizedStatus === "cancelled") return "bg-gray-50/80";
    return "hover:bg-indigo-50/30";
  }

  function getIconStyle(row) {
    const normalizedStatus = normalizeStatus(row.status);
    if (normalizedStatus === "draft") return "bg-amber-100 text-amber-700";
    if (normalizedStatus === "cancelled") return "bg-gray-200 text-gray-500";
    return "bg-indigo-50 text-indigo-600";
  }

  function buildCollectHref(row, { closeMode = false } = {}) {
    const settlement = getSettlementSummary(row);
    const params = new URLSearchParams();

    params.set("mode", "payment");
    params.set("source", closeMode ? "sale-list-close" : "sale-list");
    params.set("cariId", row.cariId || row.customerId || "");
    params.set("invoiceId", row.id || "");
    params.set("invoiceNo", row.invoiceNo || row.draftNo || "");
    params.set("amount", String(settlement.outstandingAmount || 0));
    params.set("returnTo", getRowHref(row));

    if (closeMode) {
      params.set("lockCari", "1");
      params.set("lockInvoice", "1");
      params.set("lockAmount", "1");
    }

    return `/satissitok/admin/finance/collect?${params.toString()}`;
  }

  function canCollect(row) {
    const normalizedStatus = normalizeStatus(row.status);
    if (normalizedStatus !== "confirmed") return false;
    const settlement = getSettlementSummary(row);
    return settlement.outstandingAmount > 0 && Boolean(row.cariId || row.customerId);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-7xl mx-auto space-y-6 bg-gray-50/50 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
          aria-label="Geri"
          title="Geri"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
          aria-label="Satis/Stok Ana Sayfa"
          title="Satis/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Satis Yonetimi</h1>
          <p className="text-sm text-gray-500">
            Satis belgelerini, kapanis durumlarini ve tahsilat aciklarini izleyin.
          </p>
        </div>
        <Link
          href="/satissitok/admin/sales/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
        >
          <Plus size={18} />
          <span>Yeni Satis Olustur</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mr-2 flex items-center gap-2 border-r pr-4 text-gray-400">
          <Filter size={18} />
          <span className="text-sm font-medium">Filtrele</span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="ml-1 text-[10px] font-bold uppercase text-gray-400">Islem Turu</label>
          <select
            className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm outline-none ring-1 ring-gray-200 transition-all focus:ring-2 focus:ring-indigo-500"
            value={saleType}
            onChange={(e) => setSaleType(e.target.value)}
          >
            <option value="">Tum Turler</option>
            <option value="official">Resmi Satis</option>
            <option value="actual">Fiili Satis</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="ml-1 text-[10px] font-bold uppercase text-gray-400">Platform</label>
          <select
            className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm outline-none ring-1 ring-gray-200 transition-all focus:ring-2 focus:ring-indigo-500"
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
          >
            <option value="">Tum Platformlar</option>
            <option value="kaspi">Kaspi</option>
            <option value="ozon">Ozon</option>
            <option value="showroom">Showroom</option>
            <option value="online">Online</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="ml-1 text-[10px] font-bold uppercase text-gray-400">Durum</label>
          <select
            className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm outline-none ring-1 ring-gray-200 transition-all focus:ring-2 focus:ring-indigo-500"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tum Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="confirmed">Onayli</option>
            <option value="cancelled">Iptal</option>
          </select>
        </div>

        <div className="ml-auto flex min-w-[220px] flex-1 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 md:max-w-sm">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Cari, belge no veya platform ara..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {filteredRows.some((row) => row.hasNegativeStock) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="font-semibold">Eksi stok olusan satislar var.</p>
            <p className="text-sm text-amber-800/80">
              Uyari rozetli satirlar fiziksel stok takibi icin tekrar kontrol edilmelidir.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Belge
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Cari
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Tarih
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Kanal
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                  Tutar
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Kapanis
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
                  Islem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredRows.map((row) => {
                const href = getRowHref(row);
                const normalizedStatus = normalizeStatus(row.status);
                const isDraftLike = normalizedStatus === "draft";
                const isCancelled = normalizedStatus === "cancelled";
                const settlement = getSettlementSummary(row);
                return (
                  <tr
                    key={row.id}
                    className={`group cursor-pointer transition-colors ${getRowStyle(row)}`}
                    onClick={() => router.push(href)}
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${getIconStyle(row)}`}>
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <Link
                            href={href}
                            className={`block font-semibold transition-colors hover:text-indigo-600 ${
                              isCancelled ? "text-gray-400 line-through" : "text-gray-900"
                            }`}
                          >
                            {row.invoiceNo || row.draftNo || "N/A"}
                          </Link>
                          {getStatusBadge(row)}
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`font-medium ${
                            isCancelled ? "text-gray-400 line-through" : "text-gray-800"
                          }`}
                        >
                          {caris[row.cariId] || row.cariName || "Isimsiz Cari"}
                        </span>
                        {row.hasNegativeStock && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                            <AlertTriangle size={12} />
                            Eksi Stok
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      <div className="inline-flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        <span>{formatDate(row.documentDate || row.createdAt)}</span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium uppercase text-gray-700">
                          {row.saleChannel || row.platformId || "-"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {row.saleType === "official" ? "Resmi" : "Fiili"}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold text-gray-900">
                          {formatMoney(settlement.invoiceAmount)} KZT
                        </span>
                        <span className="text-xs text-gray-400">
                          Kalan: {formatMoney(settlement.outstandingAmount)} KZT
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <SettlementBadge status={settlement.status} />
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canCollect(row) && (
                          <>
                            <Link
                              href={buildCollectHref(row)}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              title="Tahsilat Al"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <CreditCard size={14} />
                              <span>Tahsilat Al</span>
                            </Link>

                            <Link
                              href={buildCollectHref(row, { closeMode: true })}
                              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                              title="Tam Kapat"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <ChevronRight size={14} />
                              <span>Tam Kapat</span>
                            </Link>
                          </>
                        )}

                        <Link
                          href={href}
                          className="inline-flex items-center justify-center rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-indigo-100 hover:text-indigo-600"
                          title={isDraftLike ? "Taslagi duzenle" : "Detayi gor"}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <Search size={40} strokeWidth={1} />
                      <p className="text-sm font-medium italic">
                        Aradiginiz kriterlere uygun satis bulunamadi.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 text-[11px] text-gray-400">
        <span>© 2026 Satis Takip Sistemi | Enterprise V2</span>
        <span>Son guncelleme: {new Date().toLocaleTimeString("tr-TR")}</span>
      </div>
    </div>
  );
}
