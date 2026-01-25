// app/satissitok/admin/purchases/new/page.jsx
"use client";

import PurchaseForm from "./components/PurchaseForm";
import { createPurchase } from "@/app/satissitok/services/purchaseService";

export default function NewPurchasePage() {
  const savePurchase = async (payload) => {
    try {
      console.log("SUBMIT PAYLOAD >>>", payload);

      const id = await createPurchase(payload);

      alert(`Satınalma kaydedildi. ID: ${id}`);
    } catch (e) {
      // 🔴 GERÇEK HATAYI SAKLAMA
      console.error("PURCHASE ERROR >>>", e);

      const message =
        e?.message ||
        e?.code ||
        (typeof e === "string" ? e : JSON.stringify(e));

      alert(`HATA:\n${message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Yeni Satınalma</h1>
      <PurchaseForm onSubmit={savePurchase} />
    </div>
  );
}
