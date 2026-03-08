"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { Plus, Search, Filter, Calendar, CreditCard, ArrowLeft, Home, ChevronRight } from "lucide-react";

function formatDate(val) {
  if (!val) return "—";
  if (val?.toDate) return val.toDate().toLocaleDateString("tr-TR");
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("tr-TR");
  return String(val);
}

function money(n) {
  return Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchasesListPage() {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [caris, setCaris] = useState({});
  const [loading, setLoading] = useState(true);

  const [purchaseType, setPurchaseType] = useState("");
  const [status, setStatus] = useState("");
  const [supplierQ, setSupplierQ] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let q = query(collection(db, "purchases"), orderBy("createdAt", "desc"));
        if (purchaseType) q = query(q, where("purchaseType", "==", purchaseType));
        if (status) q = query(q, where("status", "==", status));

        const [snap, cariSnap] = await Promise.all([
          getDocs(q),
          getDocs(collection(db, "caris")),
        ]);

        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const cariMap = {};
        cariSnap.docs.forEach((c) => {
          cariMap[c.id] = c.data().firm || c.data().name || "İsimsiz Cari";
        });

        setCaris(cariMap);
        setRows(data);
      } catch (e) {
        console.error("PURCHASES LOAD ERROR:", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [purchaseType, status]);

  const filteredRows = useMemo(() => {
    const q = (supplierQ || "").trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const supplierName = (r.supplierName || "").toLowerCase();
      const cariName = (caris[r.supplierCariId] || "").toLowerCase();
      const invoiceNo = (r.invoiceNo || "").toLowerCase();
      return supplierName.includes(q) || cariName.includes(q) || invoiceNo.includes(q);
    });
  }, [rows, supplierQ, caris]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm" aria-label="Geri" title="Geri">
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link href="/satissitok/admin" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm" aria-label="Satış/Stok Ana Sayfa" title="Satış/Stok Ana Sayfa">
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Satınalma Yönetimi</h1>
          <p className="text-sm text-gray-500">Alış faturalarını ve taslak kayıtları tek listeden yönetin.</p>
        </div>

        <Link href="/satissitok/admin/purchases/new" className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm active:scale-95">
          <Plus size={18} />
          <span>Yeni Satınalma Oluştur</span>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-400 border-r pr-4 mr-2">
          <Filter size={18} />
          <span className="text-sm font-medium">Filtrele</span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">İşlem Türü</label>
          <select className="bg-gray-50 border-none ring-1 ring-gray-200 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none" value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)}>
            <option value="">Tüm Türler</option>
            <option value="official">Resmi</option>
            <option value="actual">Fiili</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Durum</label>
          <select className="bg-gray-50 border-none ring-1 ring-gray-200 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tümü</option>
            <option value="draft">Taslak</option>
            <option value="pending">Onay Bekliyor</option>
            <option value="completed">Tamamlandı</option>
            <option value="cancelled">İptal</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[260px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Tedarikçi / Fatura</label>
          <div className="flex items-center gap-2 bg-gray-50 ring-1 ring-gray-200 rounded-lg px-3 py-1.5">
            <Search size={16} className="text-gray-400" />
            <input className="bg-transparent outline-none text-sm w-full" placeholder="Tedarikçi adı veya fatura no..." value={supplierQ} onChange={(e) => setSupplierQ(e.target.value)} />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm text-gray-500 bg-indigo-50 px-4 py-2 rounded-lg">
          <span className="font-semibold text-indigo-700">{filteredRows.length}</span> Kayıt Bulundu
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fatura / Durum</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tür</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tedarikçi</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Toplam Tutar</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {filteredRows.map((r) => {
                const isCancelled = r.status === "cancelled";
                const isDraft = r.status === "draft";
                const supplier = caris[r.supplierCariId] || r.supplierName || "—";
                const href = isDraft
                  ? `/satissitok/admin/purchases/new?draftId=${r.id}`
                  : `/satissitok/admin/purchases/${r.id}`;

                return (
                  <tr key={r.id} className={`group hover:bg-indigo-50/30 transition-colors ${isCancelled ? "bg-gray-50/80" : ""}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isCancelled ? "bg-gray-200" : isDraft ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"}`}>
                          <CreditCard size={18} />
                        </div>

                        <div>
                          <Link href={href} className={`block font-semibold hover:text-indigo-600 transition-colors ${isCancelled ? "text-gray-400 line-through" : "text-gray-900"}`}>
                            {r.invoiceNo || (isDraft ? "Taslak satınalma" : "N/A")}
                          </Link>

                          {isDraft ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">Taslak</span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">İptal Edildi</span>
                          ) : r.status === "pending" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">Onay Bekliyor</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wider">Tamamlandı</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`text-sm ${isCancelled ? "text-gray-400" : "text-gray-700"}`}>
                          {r.purchaseType === "official" ? "🏢 Resmi" : "📦 Fiili"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-800">{supplier}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(r.documentDate || r.createdAt)}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-base font-bold ${isCancelled ? "text-gray-400 line-through" : "text-gray-900"}`}>
                        {money(r?.totals?.gross ?? r?.grossTotal ?? r?.total ?? 0)}
                        <span className="text-[10px] ml-1 text-gray-400 font-normal underline decoration-indigo-200">₸</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Link href={href} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-indigo-200 transition-all shadow-sm">
                        {isDraft ? "Taslağı Aç" : "Detayı Aç"}
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    Filtreye uygun kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
