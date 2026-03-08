// app/satissitok/admin/sales/new/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home } from "lucide-react";

import SaleForm from "./components/SaleForm";
import { createSale } from "@/app/satissitok/services/saleService";
import { getSettings } from "@/app/satissitok/services/settingsService";

const LoadingIcon = () => (
  <svg
    className="animate-spin h-5 w-5 text-blue-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

function tsToISO(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v?.toDate) return v.toDate().toISOString().slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = (searchParams.get("draftId") || "").trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState([]);
  const [caris, setCaris] = useState([]);
  const [balances, setBalances] = useState({});
  const [settings, setSettings] = useState(null);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, c, b, s, draftDoc] = await Promise.all([
        loadProducts(),
        loadCaris(),
        loadBalances(),
        getSettings(),
        loadDraft(draftId),
      ]);
      setProducts(p);
      setCaris(c);
      setBalances(b);
      setSettings(s);
      setInitialData(draftDoc);
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

  async function loadDraft(id) {
    if (!id) return null;
    const snap = await getDoc(doc(db, "sales", id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      invoiceDate: tsToISO(data.invoiceDate || data.documentDate),
      dueDate: tsToISO(data.dueDate),
      draftSavedAt: tsToISO(data.draftSavedAt) || data.draftSavedAt || null,
      updatedAt: tsToISO(data.updatedAt) || data.updatedAt || null,
    };
  }

  async function handleSubmit(payload) {
    if (saving) return;

    setSaving(true);
    try {
      const res = await createSale({
        ...payload,
        invoiceNoAuto: payload.status === "draft" ? false : payload.invoiceNoDirty ? false : true,
      });

      if (!res?.saleId) {
        throw new Error("Satış kaydı oluşturuldu ama ID alınamadı.");
      }

      if (payload.status === "draft") {
        alert("Satış taslağı kaydedildi.");
        router.push("/satissitok/admin/sales");
        return;
      }

      try {
        localStorage.removeItem("satissitok_sale_draft_v1");
      } catch {}

      router.push(`/satissitok/admin/sales/${res.saleId}`);
    } catch (e) {
      console.error("SALE_CREATE_ERROR:", e);
      alert(e?.message || "İşlem sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            {draftId ? "Satış Taslağını Düzenle" : "Yeni Satış Oluştur"}
          </h1>
          <p className="text-slate-500 text-sm">
            Sistemdeki stok ve cari bilgilerini kullanarak satış işlemini başlatın.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium border border-blue-100">
            Fatura Modülü
          </span>
          {draftId && (
            <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full font-medium border border-amber-100">
              Taslak Düzenleme
            </span>
          )}
          {saving && (
            <span className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full font-medium border border-amber-100">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
              Kaydediliyor...
            </span>
          )}
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
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
        <p className="text-xs text-slate-500 leading-relaxed italic">
          * Taslak kaydı stok ve cari hareketi oluşturmaz. Final kayıt sırasında sistem fatura numarasını üretir ve tüm
          resmi/fiili akışı çalıştırır.
        </p>
      </div>
    </main>
  );
}
