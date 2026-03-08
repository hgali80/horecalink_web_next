// app/satissitok/admin/purchases/new/page.jsx
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/firebase";
import PurchaseForm from "./components/PurchaseForm";
import {
  createPurchase,
  deleteDraftPurchase,
} from "@/app/satissitok/services/purchaseService";

function PurchasePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const draftId = (searchParams.get("draftId") || "").trim();

  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(!!draftId);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const loadDraft = async () => {
      if (!draftId) {
        setInitialData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const ref = doc(db, "purchases", draftId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          alert("Kayıt bulunamadı.");
          router.replace("/satissitok/admin/purchases");
          return;
        }

        setInitialData({
          id: snap.id,
          ...snap.data(),
        });
      } catch (e) {
        console.error("PURCHASE LOAD ERROR >>>", e);
        const message =
          e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));
        alert(`Kayıt yüklenemedi:\n${message}`);
        router.replace("/satissitok/admin/purchases");
      } finally {
        setLoading(false);
      }
    };

    loadDraft();
  }, [draftId, router]);

  const savePurchase = async (payload) => {
    try {
      setWorking(true);
      console.log("SUBMIT PAYLOAD >>>", payload);

      const id = await createPurchase(payload);
      const nextStatus = payload?.status || "completed";

      if (nextStatus === "draft") {
        alert(`Taslak kaydedildi. ID: ${id}`);
        router.replace(`/satissitok/admin/purchases/new?draftId=${id}`);
        return;
      }

      if (nextStatus === "pending") {
        alert(`Onay bekleyen kayıt kaydedildi. ID: ${id}`);
        router.replace(`/satissitok/admin/purchases/new?draftId=${id}`);
        return;
      }

      alert(`Satınalma kaydedildi. ID: ${id}`);
      router.replace(`/satissitok/admin/purchases/${id}`);
    } catch (e) {
      console.error("PURCHASE ERROR >>>", e);

      const message =
        e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));

      alert(`HATA:\n${message}`);
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteDraft = async ({ purchaseId }) => {
    try {
      setWorking(true);
      await deleteDraftPurchase({ purchaseId });

      alert("Taslak silindi.");
      router.replace("/satissitok/admin/purchases");
    } catch (e) {
      console.error("DELETE PURCHASE DRAFT ERROR >>>", e);

      const message =
        e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));

      alert(`HATA:\n${message}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900">
      <main className="p-8 max-w-[1400px] mx-auto w-full">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
            aria-label="Geri"
            title="Geri"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Geri</span>
          </button>

          <Link
            href="/satissitok/admin"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
            aria-label="Satış/Stok Ana Sayfa"
            title="Satış/Stok Ana Sayfa"
          >
            <Home size={18} />
            <span className="text-sm font-semibold">Ana Sayfa</span>
          </Link>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <div className="text-sm font-semibold text-slate-600">
              Kayıt yükleniyor...
            </div>
          </div>
        ) : (
          <PurchaseForm
            onSubmit={savePurchase}
            onDeleteDraft={handleDeleteDraft}
            initialData={initialData}
            disabled={working}
          />
        )}
      </main>
    </div>
  );
}

function PurchasePageFallback() {
  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900">
      <main className="p-8 max-w-[1400px] mx-auto w-full">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="text-sm font-semibold text-slate-600">
            Sayfa hazırlanıyor...
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NewPurchasePage() {
  return (
    <Suspense fallback={<PurchasePageFallback />}>
      <PurchasePageContent />
    </Suspense>
  );
}