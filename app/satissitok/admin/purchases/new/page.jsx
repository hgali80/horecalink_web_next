//app/satissitok/admin/purchases/new/page.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PurchaseForm from "./components/PurchaseForm";
import { createPurchase } from "@/app/satissitok/services/purchaseService";

export default function NewPurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (payload) => {
    try {
      setLoading(true);

      await createPurchase(payload);

      alert("Satınalma başarıyla kaydedildi.");
      router.push("/satissitok/admin"); // ileride liste sayfasına yönlendirilebilir
    } catch (error) {
      console.error(error);
      alert("Satınalma kaydedilirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Yeni Satınalma</h1>
        <p className="text-sm text-gray-500">
          Resmi veya fiili satınalma faturası oluşturun.
        </p>
      </div>

      {loading && (
        <div className="text-blue-600 text-sm">
          Kaydediliyor, lütfen bekleyin...
        </div>
      )}

      <PurchaseForm onSubmit={handleSubmit} />
    </div>
  );
}
