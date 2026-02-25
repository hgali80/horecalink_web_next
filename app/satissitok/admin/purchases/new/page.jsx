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

      alert(`Satınalma kaydedildi. ID: ${id}`);
    } catch (e) {
      // 🔴 GERÇEK HATAYI SAKLAMA
      console.error("PURCHASE ERROR >>>", e);

      const message =
        e?.message || e?.code || (typeof e === "string" ? e : JSON.stringify(e));

      alert(`HATA:\n${message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Top Nav */}
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

      <h1 className="text-2xl font-bold">Yeni Satınalma</h1>
      <PurchaseForm onSubmit={savePurchase} />
    </div>
  );
}