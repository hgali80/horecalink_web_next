// app/satissitok/admin/sales/new/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, doc, runTransaction } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home } from "lucide-react";

import SaleForm from "./components/SaleForm";
import { createSale } from "@/app/satissitok/services/saleService";
import { getSettings } from "@/app/satissitok/services/settingsService";

// İkonlar ve UI bileşenleri için basit SVG'ler
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

export default function NewSalePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState([]);
  const [caris, setCaris] = useState([]);
  const [balances, setBalances] = useState({});
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, c, b, s] = await Promise.all([
        loadProducts(),
        loadCaris(),
        loadBalances(),
        getSettings(),
      ]);
      setProducts(p);
      setCaris(c);
      setBalances(b);
      setSettings(s);
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
      let finalInvoiceNo = payload.invoiceNo;

      if (!payload.invoiceNoDirty) {
        await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, "sale_counters", "main");
          const counterSnap = await transaction.get(counterRef);

          if (!counterSnap.exists()) {
            throw new Error("Sayaç dökümanı bulunamadı!");
          }

          const counters = counterSnap.data();
          const nextSeq = (Number(counters[payload.saleType]) || 0) + 1;

          const yy = String(new Date().getFullYear()).slice(-2);
          const prefix = payload.saleType === "official" ? "SR" : "SF";
          finalInvoiceNo = `${prefix}-${yy}${String(nextSeq).padStart(6, "0")}`;

          transaction.update(counterRef, {
            [payload.saleType]: nextSeq,
          });
        });
      }

      const res = await createSale({
        ...payload,
        invoiceNo: finalInvoiceNo,
      });

      if (!res?.saleId) {
        throw new Error("Satış kaydı oluşturuldu ama ID alınamadı.");
      }

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
    <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* Top Nav (Geri + Ana Sayfa) */}
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

      {/* Üst Başlık ve Navigasyon Bilgisi */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Yeni Satış Oluştur</h1>
          <p className="text-slate-500 text-sm">
            Sistemdeki stok ve cari bilgilerini kullanarak satış işlemini başlatın.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium border border-blue-100">
            Fatura Modülü
          </span>
          {saving && (
            <span className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full font-medium border border-amber-100">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
              Kaydediliyor...
            </span>
          )}
        </div>
      </div>

      {/* Form Alanı Kaplayıcısı */}
      <div className={`transition-all duration-300 ${saving ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-1">
            {" "}
            {/* SaleForm içindeki paddinglerle çakışmaması için ince ayar */}
            <SaleForm
              products={products}
              caris={caris}
              balances={balances}
              settings={settings}
              onSubmit={handleSubmit}
              disabled={saving}
            />
          </div>
        </div>
      </div>

      {/* Yardımcı Alt Bilgi */}
      <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
        <p className="text-xs text-slate-500 leading-relaxed italic">
          * Fatura numarası, manuel bir giriş yapılmadığı sürece kayıt esnasında sistem tarafından otomatik olarak
          (SR-YYXXXXXX) formatında atanacaktır.
        </p>
      </div>
    </main>
  );
}