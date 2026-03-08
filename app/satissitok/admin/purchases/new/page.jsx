// app/satissitok/admin/purchases/new/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home } from "lucide-react";

import PurchaseForm from "./components/PurchaseForm";
import { createPurchase } from "@/app/satissitok/services/purchaseService";

function tsToISO(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v?.toDate) return v.toDate().toISOString().slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function NewPurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = (searchParams.get("draftId") || "").trim();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        if (!draftId) {
          setInitialData(null);
          return;
        }
        const snap = await getDoc(doc(db, "purchases", draftId));
        if (!snap.exists()) {
          setInitialData(null);
          return;
        }
        const data = snap.data();
        setInitialData({
          id: snap.id,
          ...data,
          documentDate: tsToISO(data.documentDate),
          dueDate: tsToISO(data.dueDate),
          payment: {
            ...(data.payment || {}),
            paidDate: tsToISO(data.payment?.paidDate),
          },
        });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [draftId]);

  const savePurchase = async (payload) => {
    try {
      const id = await createPurchase(payload);

      if (payload?.status === "draft") {
        alert("Satınalma taslağı kaydedildi.");
        router.push("/satissitok/admin/purchases");
        return;
      }

      alert(`Satınalma kaydedildi. ID: ${id}`);
      router.push(`/satissitok/admin/purchases/${id}`);
    } catch (e) {
      console.error("PURCHASE ERROR >>>", e);
      const message = e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));
      alert(`HATA:\n${message}`);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f6f6f8]" />;
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

        <PurchaseForm onSubmit={savePurchase} initialData={initialData} />
      </main>
    </div>
  );
}
