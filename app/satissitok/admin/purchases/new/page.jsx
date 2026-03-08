// app/satissitok/admin/purchases/new/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home } from "lucide-react";

import PurchaseForm from "./components/PurchaseForm";
import { createPurchase, deletePurchaseDraft } from "@/app/satissitok/services/purchaseService";

export default function NewPurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId");

  const [loading, setLoading] = useState(Boolean(draftId));
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    let active = true;
    const loadDraft = async () => {
      if (!draftId) {
        setInitialData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "purchases", draftId));
        if (!active) return;
        if (!snap.exists()) throw new Error("Taslak bulunamadı");
        setInitialData({ id: snap.id, ...snap.data() });
      } catch (e) {
        alert(e?.message || "Taslak yüklenemedi");
        router.push("/satissitok/admin/purchases");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDraft();
    return () => {
      active = false;
    };
  }, [draftId, router]);

  const savePurchase = async (payload) => {
    try {
      const id = await createPurchase(payload);
      router.push(payload?.status === "completed" ? `/satissitok/admin/purchases/${id}` : `/satissitok/admin/purchases`);
    } catch (e) {
      console.error("PURCHASE ERROR >>>", e);
      const message = e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));
      alert(`HATA:
${message}`);
    }
  };

  const handleDeleteDraft = async () => {
    if (!initialData?.id) return;
    if (!confirm("Bu taslağı silmek istediğine emin misin?")) return;
    try {
      await deletePurchaseDraft({ purchaseId: initialData.id });
      router.push("/satissitok/admin/purchases");
    } catch (e) {
      alert(e?.message || "Taslak silinemedi");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Taslak yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900">
      <main className="p-8 max-w-[1400px] mx-auto w-full">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Geri</span>
          </button>

          <Link
            href="/satissitok/admin"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
          >
            <Home size={18} />
            <span className="text-sm font-semibold">Ana Sayfa</span>
          </Link>
        </div>

        <PurchaseForm onSubmit={savePurchase} initialData={initialData} onDeleteDraft={handleDeleteDraft} />
      </main>
    </div>
  );
}
