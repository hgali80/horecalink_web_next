// app/satissitok/admin/purchases/new/page.jsx
"use client";

import PurchaseForm from "./components/PurchaseForm";
import { createPurchase } from "@/app/satissitok/services/purchaseService";

export default function NewPurchasePage() {
  const savePurchase = async (payload) => {
    try {
      const id = await createPurchase(payload);
      alert(`Satınalma kaydedildi. ID: ${id}`);
    } catch (e) {
      console.error(e);
      alert("Kayıt sırasında hata oluştu.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Yeni Satınalma</h1>
      <PurchaseForm onSubmit={savePurchase} />
    </div>
  );
}
