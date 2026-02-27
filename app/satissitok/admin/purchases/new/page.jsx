// app/satissitok/admin/purchases/new/page.jsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

import PurchaseForm from "./components/PurchaseForm";
import { createPurchase } from "@/app/satissitok/services/purchaseService";

export default function NewPurchasePage() {
  const router = useRouter();

  const savePurchase = async (payload) => {
    try {
      console.log("SUBMIT PAYLOAD >>>", payload);

      const id = await createPurchase(payload);

      alert(
        payload?.status === "draft"
          ? `Taslak kaydedildi. ID: ${id}`
          : `Satınalma kaydedildi. ID: ${id}`
      );
    } catch (e) {
      // 🔴 GERÇEK HATAYI SAKLAMA
      console.error("PURCHASE ERROR >>>", e);

      const message =
        e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));

      alert(`HATA:\n${message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900">
      <main className="p-8 max-w-[1400px] mx-auto w-full">
        {/* Üst Navigasyon */}
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

        <PurchaseForm onSubmit={savePurchase} />
      </main>
    </div>
  );
}