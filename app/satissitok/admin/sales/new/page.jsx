// app/satissitok/admin/sales/new/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home } from "lucide-react";

import SaleForm from "./components/SaleForm";
import { createSale, deleteSaleDraft } from "@/app/satissitok/services/saleService";
import { getSettings } from "@/app/satissitok/services/settingsService";

const LoadingIcon = () => (
  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
  </svg>
);

export default function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [caris, setCaris] = useState([]);
  const [balances, setBalances] = useState({});
  const [settings, setSettings] = useState(null);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    loadAll();
  }, [draftId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, c, b, s] = await Promise.all([loadProducts(), loadCaris(), loadBalances(), getSettings()]);
      setProducts(p);
      setCaris(c);
      setBalances(b);
      setSettings(s);
      if (draftId) {
        const snap = await getDoc(doc(db, "sales", draftId));
        if (!snap.exists()) throw new Error("Taslak bulunamadı");
        setInitialData({ id: snap.id, ...snap.data() });
      } else {
        setInitialData(null);
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || "Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    const snap = await getDocs(query(collection(db, "products"), orderBy("name")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function loadCaris() {
    const snap = await getDocs(query(collection(db, "caris"), orderBy("firm")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function loadBalances() {
    const snap = await getDocs(collection(db, "stock_balances"));
    const map = {};
    snap.docs.forEach((d) => {
      map[d.id] = d.data();
    });
    return map;
  }

  async function handleSubmit(payload) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await createSale({ ...payload, invoiceNoAuto: payload.invoiceNoDirty ? false : true });
      if (!res?.saleId) throw new Error("Satış kaydı oluşturuldu ama ID alınamadı.");
      router.push(payload?.status === "completed" ? `/satissitok/admin/sales/${res.saleId}` : `/satissitok/admin/sales`);
    } catch (e) {
      console.error("SALE_CREATE_ERROR:", e);
      alert(e?.message || "İşlem sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  const handleDeleteDraft = async () => {
    if (!initialData?.id) return;
    if (!confirm("Bu satış taslağını silmek istediğine emin misin?")) return;
    try {
      await deleteSaleDraft({ saleId: initialData.id });
      router.push("/satissitok/admin/sales");
    } catch (e) {
      alert(e?.message || "Taslak silinemedi");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <LoadingIcon />
        <p className="text-slate-500 text-sm font-medium animate-pulse">Veriler hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <main className="w-full px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm">
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>
        <Link href="/satissitok/admin" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm">
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{draftId ? "Satış Taslağını Düzenle" : "Yeni Satış Oluştur"}</h1>
          <p className="text-slate-500 text-sm">Sistemdeki stok ve cari bilgilerini kullanarak satış işlemini başlatın.</p>
        </div>
      </div>

      <div className={`transition-all duration-300 ${saving ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
        <div className="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
          <div className="p-1">
            <SaleForm
              products={products}
              caris={caris}
              balances={balances}
              settings={settings}
              onSubmit={handleSubmit}
              disabled={saving}
              initialData={initialData}
              onDeleteDraft={handleDeleteDraft}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
