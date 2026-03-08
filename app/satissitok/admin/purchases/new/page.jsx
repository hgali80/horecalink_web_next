"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Home } from "lucide-react";

import { db } from "@/firebase";
import PurchaseForm from "./components/PurchaseForm";
import { createPurchase } from "@/app/satissitok/services/purchaseService";

function normalizeDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function normalizePurchaseDraft(docSnap) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    ...data,
    documentDate: normalizeDate(data.documentDate),
    dueDate: normalizeDate(data.dueDate),
    payment: {
      ...(data.payment || {}),
      paidDate: normalizeDate(data.payment?.paidDate),
    },
  };
}

export default function NewPurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = (searchParams.get("draftId") || "").trim();

  const [saving, setSaving] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    const loadDraft = async () => {
      setLoadingDraft(true);
      try {
        if (!draftId) {
          setInitialData(null);
          return;
        }

        const snap = await getDoc(doc(db, "purchases", draftId));
        if (!snap.exists()) {
          setInitialData(null);
          alert("Taslak satınalma kaydı bulunamadı.");
          return;
        }

        setInitialData(normalizePurchaseDraft(snap));
      } finally {
        setLoadingDraft(false);
      }
    };

    loadDraft();
  }, [draftId]);

  const savePurchase = async (payload) => {
    if (saving) return;

    setSaving(true);
    try {
      const id = await createPurchase(payload);

      if (payload?.status === "draft") {
        alert("Satınalma taslağı kaydedildi.");
        router.push("/satissitok/admin/purchases");
        return;
      }

      router.push(`/satissitok/admin/purchases/${id}`);
    } catch (e) {
      console.error("PURCHASE ERROR >>>", e);
      const message = e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));
      alert(`HATA:
${message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadingDraft) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

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

          {draftId && (
            <div className="ml-auto px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">
              Taslak düzenleme modu
            </div>
          )}
        </div>

        <PurchaseForm onSubmit={savePurchase} initialData={initialData} draftId={draftId || null} />
      </main>
    </div>
  );
}
