// app/satissitok/admin/sales/page.jsx
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
        let q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
        if (saleType) q = query(q, where("saleType", "==", saleType));
        if (platformId) q = query(q, where("saleChannel", "==", platformId));
        if (status) q = query(q, where("status", "==", status));

        const saleSnap = await getDocs(q);
        const saleData = saleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const cariSnap = await getDocs(collection(db, "caris"));
        const cariMap = {};
        cariSnap.docs.forEach((doc) => {
          cariMap[doc.id] = doc.data().firm || doc.data().name || "İsimsiz Cari";
        });

        setCaris(cariMap);
        setRows(saleData);
      } catch (error) {
        console.error("Yükleme hatası:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [saleType, platformId, status]);

  const filteredRows = useMemo(() => {
    const q = (searchQ || "").trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const cariName = (caris[r.cariId] || "").toLowerCase();
      const invoiceNo = (r.invoiceNo || "").toLowerCase();
      const draftNo = (r.draftNo || "").toLowerCase();
      const platform = (r.saleChannel || r.platformId || "").toLowerCase();
      return (
        cariName.includes(q) ||
        invoiceNo.includes(q) ||
        draftNo.includes(q) ||
        platform.includes(q)
      );
    });
  }, [rows, searchQ, caris]);

  function formatDate(val) {
    if (!val) return "—";
    if (val?.toDate) return val.toDate().toLocaleDateString("tr-TR");
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("tr-TR");
    return "—";
  }

  function getRowHref(r) {
    if (r.status === "draft" || r.status === "pending") {
      return `/satissitok/admin/sales/new?draftId=${r.id}`;
    }
    return `/satissitok/admin/sales/${r.id}`;
  }

  function getStatusBadge(r) {
    if (r.status === "draft") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
          Taslak
        </span>
      );
    }

    if (r.status === "pending") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
          Onay Bekliyor
        </span>
      );
    }

    if (r.status === "cancelled") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
          İptal Edildi
        </span>
      );
    }

    if (r.status === "returned") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">
          İade
        </span>
      );
    }

    return (
      <span className="text-[11px] text-gray-400 font-medium tracking-tight">
        E-Fatura Kesildi
      </span>
    );
  }

  function getRowStyle(r) {
    if (r.status === "draft") return "bg-amber-50/70 hover:bg-amber-50";
    if (r.status === "pending") return "bg-blue-50/60 hover:bg-blue-50";
    if (r.status === "cancelled") return "bg-gray-50/80";
    if (r.status === "returned") return "bg-purple-50/60 hover:bg-purple-50";
    return "hover:bg-indigo-50/30";
  }

  function getIconStyle(r) {
    if (r.status === "draft") return "bg-amber-100 text-amber-700";
    if (r.status === "pending") return "bg-blue-100 text-blue-700";
    if (r.status === "cancelled") return "bg-gray-200 text-gray-500";
    if (r.status === "returned") return "bg-purple-100 text-purple-700";
    return "bg-indigo-50 text-indigo-600";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      {/* Top Nav */}
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
          aria-label="Satış/Stok Ana Sayfa"
          title="Satış/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Satış Yönetimi
          </h1>
          <p className="text-sm text-gray-500">
            Tüm satış operasyonlarını, taslakları ve fatura durumlarını izleyin.
          </p>
        </div>
        <Link
          href="/satissitok/admin/sales/new"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm active:scale-95"
        >
          <Plus size={18} />
          <span>Yeni Satış Oluştur</span>
        </Link>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-400 border-r pr-4 mr-2">
          <Filter size={18} />
          <span className="text-sm font-medium">Filtrele</span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
            İşlem Türü
          </label>
          <select
            className="bg-gray-50 border-none ring-1 ring-gray-200 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            value={saleType}
            onChange={(e) => setSaleType(e.target.value)}
          >
            <option value="">Tüm Türler</option>
            <option value="official">Resmi Satış</option>
            <option value="actual">Fiili Satış</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
            Platform
          </label>
          <select
            className="bg-gray-50 border-none ring-1 ring-gray-200 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
          >
            <option value="">Tüm Platformlar</option>
            <option value="kaspi">Kaspi</option>
            <option value="ozon">Ozon</option>
            <option value="showroom">Showroom</option>
            <option value="online">Online</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
            Durum
          </label>
          <select
            className="bg-gray-50 border-none ring-1 ring-gray-200 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tümü</option>
            <option value="draft">Taslak</option>
            <option value="pending">Onay Bekliyor</option>
            <option value="completed">Tamamlandı</option>
            <option value="cancelled">İptal</option>
            <option value="returned">İade</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[260px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
            Cari / Belge / Platform
          </label>
          <div className="flex items-center gap-2 bg-gray-50 ring-1 ring-gray-200 rounded-lg px-3 py-1.5">
            <Search size={16} className="text-gray-400" />
            <input
              className="bg-transparent outline-none text-sm w-full"
              placeholder="Cari adı, belge no veya platform..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm text-gray-500 bg-indigo-50 px-4 py-2 rounded-lg">
          <span className="font-semibold text-indigo-700">
            {filteredRows.length}
          </span>{" "}
          Kayıt Bulundu
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Fatura / Durum
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Tür & Platform
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Cari Bilgisi
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Tarih
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Toplam Tutar
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredRows.map((r) => {
                const href = getRowHref(r);
                const isDraftLike = r.status === "draft" || r.status === "pending";
                const isCancelled = r.status === "cancelled";

                return (
                  <tr
                    key={r.id}
                    className={`group transition-colors ${getRowStyle(r)}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getIconStyle(r)}`}>
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <Link
                            href={href}
                            className={`block font-semibold hover:text-indigo-600 transition-colors ${
                              isCancelled ? "text-gray-400 line-through" : "text-gray-900"
                            }`}
                          >
                            {r.invoiceNo || r.draftNo || "N/A"}
                          </Link>
                          {getStatusBadge(r)}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`text-sm ${
                            isCancelled ? "text-gray-400" : "text-gray-700"
                          }`}
                        >
                          {r.saleType === "official" ? "🏢 Resmi" : "📦 Fiili"}
                        </span>
                        <span className="text-xs text-gray-400 font-medium italic">
                          @{r.saleChannel || r.platformId || "—"}
                        </span>
                        {isDraftLike && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            Düzenlenebilir kayıt
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-800">
                        {caris[r.cariId] || r.cariId || "—"}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(r.invoiceDate || r.documentDate)}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div
                        className={`text-base font-bold ${
                          isCancelled ? "text-gray-400 line-through" : "text-gray-900"
                        }`}
                      >
                        {Number(r.grossTotal || 0).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}
                        <span className="text-[10px] ml-1 text-gray-400 font-normal underline decoration-indigo-200">
                          ₸
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {r.hasNegativeStock && r.status === "completed" && (
                          <div className="group/tool relative flex items-center">
                            <AlertTriangle size={18} className="text-amber-500 animate-pulse" />
                            <span className="absolute bottom-full mb-2 hidden group-hover/tool:block bg-gray-800 text-white text-[10px] p-1 rounded whitespace-nowrap">
                              Eksi Stok!
                            </span>
                          </div>
                        )}
                        <Link
                          href={href}
                          className="p-1.5 hover:bg-white rounded-full transition-shadow hover:shadow-sm text-gray-400 hover:text-indigo-600"
                          title={isDraftLike ? "Düzenle" : "Detay"}
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
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <Search size={40} strokeWidth={1} />
                      <p className="text-sm font-medium italic">
                        Aradığınız kriterlere uygun satış bulunamadı.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Summary Info */}
      <div className="text-[11px] text-gray-400 flex justify-between items-center px-2">
        <span>© 2026 Satış Takip Sistemi | Enterprise V2</span>
        <span>Son güncelleme: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}