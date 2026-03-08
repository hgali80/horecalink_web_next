// app/satissitok/admin/purchases/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { Plus, Filter, Calendar, CreditCard, ChevronRight, ArrowLeft, Home } from "lucide-react";

function formatDate(v) {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("tr-TR") : "-";
}
function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function badge(status) {
  if (status === "draft") return "bg-amber-100 text-amber-700";
  if (status === "pending") return "bg-blue-100 text-blue-700";
  if (status === "cancelled") return "bg-red-100 text-red-700";
  return "bg-emerald-100 text-emerald-700";
}
function badgeText(status) {
  if (status === "draft") return "Taslak";
  if (status === "pending") return "Onay Bekliyor";
  if (status === "cancelled") return "İptal";
  return "Onaylandı";
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
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const cariSnap = await getDocs(collection(db, "caris"));
        const cariMap = {};
        cariSnap.docs.forEach((c) => { cariMap[c.id] = c.data().firm || c.data().name || "İsimsiz Cari"; });
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

  const goHref = (r) => (r.status === "draft" || r.status === "pending" ? `/satissitok/admin/purchases/new?draftId=${r.id}` : `/satissitok/admin/purchases/${r.id}`);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]">Yükleniyor...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"><ArrowLeft size={18} /><span className="text-sm font-semibold">Geri</span></button>
        <Link href="/satissitok/admin" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"><Home size={18} /><span className="text-sm font-semibold">Ana Sayfa</span></Link>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900 tracking-tight">Satınalma Yönetimi</h1></div>
        <Link href="/satissitok/admin/purchases/new" className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm"><Plus size={18} /><span>Yeni Satınalma</span></Link>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-400 border-r pr-4 mr-2"><Filter size={18} /><span className="text-sm font-medium">Filtrele</span></div>
        <select className="bg-gray-50 ring-1 ring-gray-200 rounded-lg py-1.5 px-3 text-sm" value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)}><option value="">Tüm Türler</option><option value="official">Resmi Satınalma</option><option value="actual">Fiili Satınalma</option></select>
        <select className="bg-gray-50 ring-1 ring-gray-200 rounded-lg py-1.5 px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tüm Durumlar</option><option value="draft">Taslak</option><option value="pending">Onay Bekliyor</option><option value="completed">Onaylandı</option><option value="cancelled">İptal</option></select>
        <input value={supplierQ} onChange={(e) => setSupplierQ(e.target.value)} placeholder="Tedarikçi / fatura ara" className="bg-gray-50 ring-1 ring-gray-200 rounded-lg py-1.5 px-3 text-sm" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50"><tr><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Fatura / Durum</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Tür</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Tedarikçi</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Tarih</th><th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Toplam</th><th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">İşlem</th></tr></thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredRows.map((r) => { const supplier = caris[r.supplierCariId] || r.supplierName || "—"; return (
              <tr key={r.id} className={`group transition-colors ${r.status === "draft" ? "bg-amber-50/60" : r.status === "pending" ? "bg-blue-50/50" : r.status === "cancelled" ? "bg-gray-50/80" : "hover:bg-indigo-50/30"}`}>
                <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><CreditCard size={18} /></div><div><Link href={goHref(r)} className="block font-semibold hover:text-indigo-600 text-gray-900">{r.invoiceNo || "N/A"}</Link><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badge(r.status)}`}>{badgeText(r.status)}</span></div></div></td>
                <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{r.purchaseType === "official" ? "🏢 Resmi" : "📦 Fiili"}</span></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-semibold text-gray-800">{supplier}</div></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-2 text-sm text-gray-500 font-medium"><Calendar size={14} className="text-gray-400" />{formatDate(r.documentDate || r.invoiceDate)}</div></td>
                <td className="px-6 py-4 whitespace-nowrap text-right"><div className="text-base font-bold text-gray-900">{fmtMoney(r.grossTotal)} ₸</div></td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><Link href={goHref(r)} className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold text-sm">Aç <ChevronRight size={16} /></Link></td>
              </tr>
            )})}
          </tbody></table></div>
      </div>
    </div>
  );
}
