//app/satissitok/admin/sales/[saleId]/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { AlertTriangle } from "lucide-react";

export default function SaleDetailPage() {
  const { saleId } = useParams();

  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!saleId) return;

    const load = async () => {
      const saleRef = doc(db, "sales", saleId);
      const saleSnap = await getDoc(saleRef);

      if (!saleSnap.exists()) {
        setSale(null);
        setLoading(false);
        return;
      }

      const itemsSnap = await getDocs(
        collection(db, "sales", saleId, "items")
      );

      setSale({ id: saleId, ...saleSnap.data() });
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };

    load();
  }, [saleId]); // ✅ DOĞRU DEPENDENCY

  if (loading) return <div className="p-6">Yükleniyor…</div>;
  if (!sale) return <div className="p-6">Satış bulunamadı</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="border p-4 rounded space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{sale.invoiceNo}</h1>
          {sale.hasNegativeStock && (
            <span className="text-red-600 flex items-center gap-1">
              <AlertTriangle size={16} /> Negatif stok
            </span>
          )}
        </div>

        <div className="text-sm text-gray-600">
          Tür: {sale.saleType === "official" ? "Resmi" : "Fiili"} | Platform:{" "}
          {sale.saleChannel}
        </div>
      </div>

      {sale.hasNegativeStock && (
        <div className="border border-red-400 bg-red-50 p-3 rounded text-sm text-red-700">
          <b>Negatif stoklu ürünler:</b>
          <ul className="list-disc ml-5 mt-1">
            {(sale.negativeStockItems || []).map((n, i) => (
              <li key={i}>
                {n.productId}: mevcut {n.available}, satılan {n.sold}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Ürün</th>
              <th className="p-2">Miktar</th>
              <th className="p-2">Birim</th>
              <th className="p-2 text-right">Fiyat</th>
              <th className="p-2 text-right">Net</th>
              <th className="p-2 text-right">KDV</th>
              <th className="p-2 text-right">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-2">{it.productName}</td>
                <td className="p-2">{it.quantity}</td>
                <td className="p-2">{it.unit}</td>
                <td className="p-2 text-right">
                  {Number(it.unitPrice || 0).toFixed(2)}
                </td>
                <td className="p-2 text-right">
                  {Number(it.net || 0).toFixed(2)}
                </td>
                <td className="p-2 text-right">
                  {Number(it.vat || 0).toFixed(2)}
                </td>
                <td className="p-2 text-right">
                  {Number(it.total || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border p-4 rounded grid grid-cols-3 gap-4 text-sm">
        <div>Net: {Number(sale.netTotal || 0).toFixed(2)}</div>
        <div>KDV: {Number(sale.vatTotal || 0).toFixed(2)}</div>
        <div>Genel: {Number(sale.grossTotal || 0).toFixed(2)}</div>
      </div>
    </div>
  );
}
