//app/satissitok/admin/purchases/new/page.jsx
"use client";

import { useState } from "react";
import PurchaseItemsTable from "./components/PurchaseItemsTable";

export default function NewPurchasePage() {
  const [items, setItems] = useState([]);

  // 🔹 SATIR BAZLI TOPLAMLAR
  const netToplam = items.reduce(
    (sum, i) => sum + (i.lineTotal - i.vatAmount),
    0
  );

  const kdvToplam = items.reduce(
    (sum, i) => sum + i.vatAmount,
    0
  );

  const genelToplam = items.reduce(
    (sum, i) => sum + i.lineTotal,
    0
  );

  const savePurchase = async () => {
    if (items.length === 0) {
      alert("En az bir ürün eklemelisiniz.");
      return;
    }

    // Burada sadece KAYDETME yapılacak
    // KDV HESABI YOK
    alert("Satınalma kaydedildi (demo).");
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Yeni Satınalma</h1>

      <PurchaseItemsTable onChange={setItems} />

      {/* 🔽 TOPLAM ALANI */}
      <div className="text-right space-y-1 text-lg">
        <div>Net Toplam: {netToplam.toLocaleString()} ₸</div>
        <div>KDV: {kdvToplam.toLocaleString()} ₸</div>
        <div className="font-bold">
          Genel Toplam: {genelToplam.toLocaleString()} ₸
        </div>
      </div>

      <div className="text-right">
        <button
          onClick={savePurchase}
          className="px-6 py-2 bg-green-600 text-white rounded"
        >
          Satınalma Kaydet
        </button>
      </div>
    </div>
  );
}
