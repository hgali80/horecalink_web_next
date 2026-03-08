// app/satissitok/admin/purchases/new/page.jsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

import PurchaseForm from "./components/PurchaseForm";
import { finalizePurchase, getPurchaseDraft, savePurchaseDraft } from "@/app/satissitok/services/purchaseService";

export default function NewPurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") || "";

  const [draftDoc, setDraftDoc] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadDraft = async () => {
      if (!draftId) {
        setDraftDoc(null);
        return;
      }
      setLoading(true);
      try {
        const data = await getPurchaseDraft(draftId);
        setDraftDoc(data);
      } finally {
        setLoading(false);
      }
    };
    loadDraft();
  }, [draftId]);

  const savePurchase = async (payload) => {
    try {
      if ((payload?.status || "").trim() === "draft") {
        const id = await savePurchaseDraft({ ...payload, draftId }, draftId || null);
        router.replace(`/satissitok/admin/purchases/new?draftId=${id}`);
        alert(`Satınalma taslağı kaydedildi. Taslak ID: ${id}`);
        setDraftDoc(await getPurchaseDraft(id));
        return;
      }

      const id = await finalizePurchase({ ...payload, draftId: draftId || null });
      router.push(`/satissitok/admin/purchases/${id}`);
    } catch (e) {
      console.error("PURCHASE ERROR >>>", e);
      const message = e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));
      alert(`HATA:
${message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900">
      <main className="p-8 max-w-[1400px] mx-auto w-full">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm" aria-label="Geri" title="Geri">
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Geri</span>
          </button>

          <Link href="/satissitok/admin" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm" aria-label="Satış/Stok Ana Sayfa" title="Satış/Stok Ana Sayfa">
            <Home size={18} />
            <span className="text-sm font-semibold">Ana Sayfa</span>
          </Link>

          {draftDoc?.draftNo && <span className="ml-auto px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">{draftDoc.draftNo}</span>}
        </div>

        {loading ? <div className="p-6 text-sm text-slate-500">Taslak yükleniyor...</div> : <PurchaseForm onSubmit={savePurchase} initialData={draftDoc} draftMeta={draftDoc} isEditingDraft={Boolean(draftId)} />}
      </main>
    </div>
  );
}
