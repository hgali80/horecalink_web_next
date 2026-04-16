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
            <option value="">Tumu</option>
            <option value="draft">Taslak</option>
            <option value="confirmed">Onayli</option>
            <option value="cancelled">Iptal / Iade</option>
          </select>
        </div>

        <div className="flex min-w-[260px] flex-col gap-1">
          <label className="ml-1 text-[10px] font-bold uppercase text-gray-400">
            Cari / Belge / Platform
          </label>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 ring-1 ring-gray-200">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Cari adi, belge no veya platform..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 text-sm text-gray-500">
          <span className="font-semibold text-indigo-700">{filteredRows.length}</span> Kayit Bulundu
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Belge / Durum
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Tur & Platform
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Cari
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Tarih
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
                  <tr key={row.id} className={`group transition-colors ${getRowStyle(row)}`}>
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
                        <span className={`text-sm ${isCancelled ? "text-gray-400" : "text-gray-700"}`}>
                          {row.saleType === "official" ? "Resmi" : "Fiili"}
                        </span>
                        <span className="text-xs italic font-medium text-gray-400">
                          @{row.saleChannel || row.platformId || "-"}
                        </span>
                        {isDraftLike && (
                          <span className="text-[11px] font-medium text-slate-500">
                            Duzenlenebilir kayit
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-semibold text-gray-800">
                        {caris[row.cariId] || row.cariId || "-"}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(row.invoiceDate || row.documentDate)}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div
                        className={`text-base font-bold ${
                          isCancelled ? "text-gray-400 line-through" : "text-gray-900"
                        }`}
                      >
                        {formatMoney(settlement.invoiceAmount)}
                        <span className="ml-1 text-[10px] font-normal text-gray-400">₸</span>
                      </div>
                      {normalizedStatus === "confirmed" && (
                        <div className="mt-1 text-xs text-amber-700">
                          Acik: {formatMoney(settlement.outstandingAmount)} ₸
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {normalizedStatus === "confirmed" ? (
                        <div className="space-y-1">
                          <SettlementBadge status={settlement.status} />
                          <div className="text-xs text-gray-500">
                            Tahsil: {formatMoney(settlement.settledAmount)} ₸
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {row.hasNegativeStock && normalizedStatus === "confirmed" && (
                          <div className="group/tool relative flex items-center">
                            <AlertTriangle size={18} className="animate-pulse text-amber-500" />
                            <span className="absolute bottom-full mb-2 hidden whitespace-nowrap rounded bg-gray-800 p-1 text-[10px] text-white group-hover/tool:block">
                              Eksi stok uyarisi
                            </span>
                          </div>
                        )}
                        <Link
                          href={href}
                          className="rounded-full p-1.5 text-gray-400 transition-shadow hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                          title={isDraftLike ? "Duzenle" : "Detay"}
                        >
                          <ChevronRight size={20} />
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
