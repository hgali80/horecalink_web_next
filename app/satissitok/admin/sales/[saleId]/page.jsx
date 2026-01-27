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

function formatDate(ts) {
  if (!ts?.toDate) return "-";
  return ts.toDate().toLocaleString();
}

function money(n) {
  return Number(n || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SaleDetailPage() {
  const { saleId } = useParams();
  const router = useRouter();

  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [cari, setCari] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [saleId]);

  async function loadData() {
    setLoading(true);

    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await getDoc(saleRef);

    if (!saleSnap.exists()) {
      alert("Satış bulunamadı");
      router.push("/satissitok/admin/sales");
      return;
    }

    const saleData = { id: saleSnap.id, ...saleSnap.data() };
    setSale(saleData);

    const itemsSnap = await getDocs(
      collection(db, "sales", saleId, "items")
    );
    setItems(itemsSnap.docs.map((d) => d.data()));

    if (saleData.cariId) {
      const cariSnap = await getDoc(
        doc(db, "caris", saleData.cariId)
      );
      setCari(cariSnap.exists() ? cariSnap.data() : null);
    }

    setLoading(false);
  }

  async function doCancel() {
    if (!confirm("Satışı iptal etmek istiyor musun?")) return;

    setProcessing(true);
    try {
      await cancelSale({ saleId });
      await loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function doReturn() {
    if (!confirm("Satışı iade almak istiyor musun?")) return;

    setProcessing(true);
    try {
      await returnSale({ saleId });
      await loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Satış Detayı #{sale.saleNo}
        </h1>

        <button
          onClick={() => router.back()}
          className="underline"
        >
          Geri
        </button>
      </div>

      {/* Genel Bilgi */}
      <div className="border p-4 space-y-1">
        <div>
          <b>Tarih:</b> {formatDate(sale.createdAt)}
        </div>
        <div>
          <b>Tip:</b>{" "}
          {sale.saleType === "official"
            ? "Resmi"
            : "Fiili"}
        </div>
        <div>
          <b>Durum:</b> {sale.status}
        </div>
        <div>
          <b>Cari:</b> {cari?.firm || "-"}
        </div>
      </div>

      {/* Ürünler */}
      <div>
        <h2 className="font-medium mb-2">Ürünler</h2>

        <table className="w-full border text-sm">
          <thead>
            <tr>
              <th className="border p-1">Ürün</th>
              <th className="border p-1">Miktar</th>
              <th className="border p-1">Fiyat</th>
              <th className="border p-1">KDV</th>
              <th className="border p-1">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="border p-1">
                  {it.productName || it.productId}
                </td>
                <td className="border p-1 text-right">
                  {it.quantity}
                </td>
                <td className="border p-1 text-right">
                  {money(it.unitPrice)}
                </td>
                <td className="border p-1 text-right">
                  {it.vat || 0}
                </td>
                <td className="border p-1 text-right">
                  {money(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Toplamlar */}
      <div className="border p-4 space-y-1">
        <div>Net: {money(sale.netTotal)}</div>
        <div>KDV: {money(sale.vatTotal)}</div>
        <div className="font-semibold">
          Toplam: {money(sale.grossTotal)}
        </div>
      </div>

      {/* Aksiyonlar */}
      {sale.status === "completed" && (
        <div className="flex gap-4">
          <button
            onClick={doCancel}
            disabled={processing}
            className="px-4 py-2 border border-red-600 text-red-600 rounded"
          >
            Satışı İptal Et
          </button>

          <button
            onClick={doReturn}
            disabled={processing}
            className="px-4 py-2 border rounded"
          >
            Satışı İade Al
          </button>
        </div>
      )}
    </div>
  );
}
