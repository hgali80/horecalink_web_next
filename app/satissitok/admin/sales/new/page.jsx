"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { ArrowLeft, Home } from "lucide-react";

import { db } from "@/firebase";
import SaleForm from "./components/SaleForm";
import { createSale, deleteDraftSale } from "@/app/satissitok/services/saleService";
import { getSettings } from "@/app/satissitok/services/settingsService";

const LoadingIcon = () => (
  <svg
    className="h-5 w-5 animate-spin text-sky-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

function ShellLoading({ label }) {
  return (
    <div className="min-h-screen bg-[#f7f9fb] px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center space-y-4 rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
        <LoadingIcon />
        <p className="text-sm font-semibold text-slate-600 animate-pulse">{label}</p>
      </div>
    </div>
  );
}

function SalesPageContent() {
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
    let ignore = false;

    async function run() {
      setLoading(true);
      try {
        let draft = null;
        if (draftId) {
          const ref = doc(db, "sales", draftId);
          const snap = await getDoc(ref);

          if (!snap.exists()) {
            if (!ignore) {
              alert("Satis kaydi bulunamadi.");
              router.replace("/satissitok/admin/sales");
            }
            return;
          }

          draft = {
            id: snap.id,
            ...snap.data(),
          };
        }

        const [p, c, b, s, loadedDraft] = await Promise.all([
          loadProducts(),
          loadCaris(),
          loadBalances(),
          getSettings(),
          Promise.resolve(draft),
        ]);

        if (ignore) return;
        setProducts(p);
        setCaris(c);
        setBalances(b);
        setSettings(s);
        setInitialData(loadedDraft);
      } catch (e) {
        if (ignore) return;
        console.error("SALE PAGE LOAD ERROR:", e);
        alert(e?.message || "Sayfa yuklenirken bir hata olustu.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    run();
    return () => {
      ignore = true;
    };
  }, [draftId, router]);

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
      const res = await createSale({
        ...payload,
        invoiceNoAuto: payload.invoiceNoDirty ? false : true,
      });

      if (!res?.saleId) {
        throw new Error("Satis kaydi olusturuldu ama ID alinamadi.");
      }

      const nextStatus = payload?.status || "completed";

      if (nextStatus === "draft") {
        alert(`Taslak kaydedildi. ID: ${res.saleId}`);
        router.replace(`/satissitok/admin/sales/new?draftId=${res.saleId}`);
        return;
      }

      if (nextStatus === "pending") {
        alert(`Onay bekleyen kayit kaydedildi. ID: ${res.saleId}`);
        router.replace(`/satissitok/admin/sales/new?draftId=${res.saleId}`);
        return;
      }

      router.push(`/satissitok/admin/sales/${res.saleId}`);
    } catch (e) {
      console.error("SALE_CREATE_ERROR:", e);
      alert(e?.message || "Islem sirasinda bir hata olustu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDraft({ saleId }) {
    if (!saleId) {
      alert("Silinecek taslak bulunamadi.");
      return;
    }

    setSaving(true);
    try {
      await deleteDraftSale({ saleId });
      alert("Taslak silindi.");
      router.replace("/satissitok/admin/sales");
    } catch (e) {
      console.error("SALE_DELETE_DRAFT_ERROR:", e);
      alert(e?.message || "Taslak silinirken bir hata olustu.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ShellLoading label="Satis faturasi ekrani hazirlaniyor..." />;
  }

  return (
    <main className="min-h-screen bg-[#f7f9fb]">
      <div className="mx-auto max-w-[1760px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-lg px-1 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-900"
              aria-label="Geri"
              title="Geri"
            >
              <ArrowLeft size={17} />
              <span>Geri</span>
            </button>

            <Link
              href="/satissitok/admin"
              className="inline-flex items-center gap-2 rounded-lg px-1 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-900"
              aria-label="Satis Stok Ana Sayfa"
              title="Satis Stok Ana Sayfa"
            >
              <Home size={17} />
              <span>Ana Sayfa</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-200 px-3 py-1 font-bold uppercase tracking-[0.16em] text-slate-600">
              {draftId ? "Duzenleme Modu" : "Yeni Kayit"}
            </span>
            {saving && (
              <span className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                Kaydediliyor
              </span>
            )}
          </div>
        </div>

        <div
          className={`transition-all duration-300 ${
            saving ? "pointer-events-none opacity-70" : "opacity-100"
          }`}
        >
          <SaleForm
            products={products}
            caris={caris}
            balances={balances}
            settings={settings}
            onSubmit={handleSubmit}
            onDeleteDraft={handleDeleteDraft}
            initialData={initialData}
            disabled={saving}
          />
        </div>

        <div className="mt-6 rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs leading-6 text-slate-500">
            Belge numarasi manuel girilmediginde kayit aninda sistem tarafindan otomatik uretilir.
            Draft ve pending kayitlar SD, tamamlanan kayitlar ise SR veya SF formatini kullanir.
          </p>
        </div>
      </div>
    </main>
  );
}

function SalesPageFallback() {
  return <ShellLoading label="Sayfa hazirlaniyor..." />;
}

export default function NewSalePage() {
  return (
    <Suspense fallback={<SalesPageFallback />}>
      <SalesPageContent />
    </Suspense>
  );
}
