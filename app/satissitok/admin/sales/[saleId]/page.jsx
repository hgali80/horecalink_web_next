//app/satissitok/admin/sales/[saleId]/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  doc,
  getDoc,
  getDocs,
  collection,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  cancelSale,
  returnSale,
} from "@/app/satissitok/services/saleService";

function money(n) {
  return Number(n || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(ts) {
  if (!ts?.toDate) return "-";
  return ts.toDate().toLocaleString();
}

export default function SaleDetailPage() {
  const { saleId } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    load();
  }, [saleId]);

  async function load() {
    setLoading(true);

    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await getDoc(saleRef);

    if (!saleSnap.exists()) {
      setLoading(false);
      return;
    }

    setSale({ id: saleSnap.id, ...saleSnap.data() });

    const itemsSnap = await getDocs(
      collection(db, "sales", saleId, "items")
    );

    setItems(
      itemsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );

    setLoading(false);
  }

  async function handleCancel() {
    if (!confirm("Bu satışı iptal etmek istiyor musunuz?")) return;

    setWorking(true);
    try {
      await cancelSale({ saleId });
      await load();
    } finally {
      setWorking(false);
    }
  }

  async function handleReturn() {
    if (!confirm("Bu satışı iade almak istiyor musunuz?")) return;

    setWorking(true);
    try {
      await returnSale({ saleId });
      await load();
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <div className="p-6">Yükleniyor…</div>;
  }

  if (!sale) {
    return <div className="p-6">Satış bulunamadı</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* ========================= */}
      {/* BAŞLIK */}
      {/* ========================= */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Satış Detayı
        </h1>

        <div className="flex gap-2">
          {sale.status === "completed" && (
            <>
              <button
                disabled={working}
                onClick={handleCancel}
                className="px-3 py-1 border rounded text-red-600"
              >
                İptal Et
              </button>

              <button
                disabled={working}
                onClick={handleReturn}
                className="px-3 py-1 border rounded"
              >
                İade Al
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================= */}
      {/* BELGE BİLGİLERİ */}
      {/* ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded">
        <Info label="Satış No" value={sale.saleNo} />
        <Info
          label="Satış Türü"
          value={
            sale.saleType === "official"
              ? "Resmi"
              : "Fiili"
          }
        />
        <Info
          label="Tarih"
          value={formatDate(sale.createdAt)}
        />

        <Info label="Cari ID" value={sale.cariId} />
        <Info
          label="Durum"
          value={sale.status}
        />
      </div>

      {/* ========================= */}
      {/* KALEMLER */}
      {/* ========================= */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Ürün</th>
              <th className="p-2 text-right">Miktar</th>
              <th className="p-2 text-right">Birim Fiyat</th>
              <th className="p-2 text-right">Net</th>
              <th className="p-2 text-right">KDV</th>
              <th className="p-2 text-right">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-2">
                  {it.productName}
                </td>
                <td className="p-2 text-right">
                  {it.quantity}
                </td>
                <td className="p-2 text-right">
                  {money(it.unitPrice)}
                </td>
                <td className="p-2 text-right">
                  {money(it.net)}
                </td>
                <td className="p-2 text-right">
                  {money(it.vat)}
                </td>
                <td className="p-2 text-right">
                  {money(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ========================= */}
      {/* TOPLAMLAR */}
      {/* ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded">
        <Info
          label="Net Toplam"
          value={money(sale.netTotal)}
        />
        <Info
          label="KDV Toplam"
          value={money(sale.vatTotal)}
        />
        <Info
          label="Genel Toplam"
          value={money(sale.grossTotal)}
        />
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="font-semibold">
        {value ?? "-"}
      </div>
    </div>
  );
}
