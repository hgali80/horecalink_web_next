//app/satissitok/admin/stock/[productId]/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";

function fmtMoney(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(ts) {
  if (!ts?.toDate) return "-";
  const d = ts.toDate();
  return d.toLocaleDateString("tr-TR");
}

export default function StockMovementsPage() {
  const { productId } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔹 Ürün bilgisi (doğrudan doc oku)
  useEffect(() => {
    const loadProduct = async () => {
      try {
        const ref = doc(db, "products", productId);
        const snap = await getDoc(ref);
        setProduct(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (e) {
        console.error("PRODUCT LOAD ERROR:", e);
      }
    };
    loadProduct();
  }, [productId]);

  // 🔹 Stok hareketleri
  useEffect(() => {
    const loadMovements = async () => {
      try {
        const q = query(
          collection(db, "stock_movements"),
          where("productId", "==", productId),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        setMovements(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (e) {
        console.error("STOCK MOVEMENTS ERROR:", e);
        setError(
          "Stok hareketleri yüklenemedi. Büyük ihtimalle Firestore index eksik."
        );
      } finally {
        setLoading(false);
      }
    };

    loadMovements();
  }, [productId]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="text-blue-600 mb-4">
          ← Geri
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-blue-600"
        >
          ← Geri
        </button>
        <h1 className="text-2xl font-bold">
          Stok Hareketleri
        </h1>
      </div>

      <div className="text-gray-700">
        <div>
          <strong>Ürün:</strong>{" "}
          {product?.name || productId}
        </div>
        <div>
          <strong>Birim:</strong>{" "}
          {product?.unit || "-"}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2">Tarih</th>
              <th className="border px-3 py-2">Tür</th>
              <th className="border px-3 py-2">Resmi / Fiili</th>
              <th className="border px-3 py-2">Fatura No</th>
              <th className="border px-3 py-2">Tedarikçi</th>
              <th className="border px-3 py-2">Miktar</th>
              <th className="border px-3 py-2">Birim Maliyet</th>
              <th className="border px-3 py-2">Toplam</th>
            </tr>
          </thead>

          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2 text-center">
                  {fmtDate(m.createdAt)}
                </td>
                <td className="border px-3 py-2 text-center">
                  {m.type === "purchase" ? "Satınalma" : m.type}
                </td>
                <td className="border px-3 py-2 text-center">
                  {m.purchaseType === "official"
                    ? "Resmi"
                    : m.purchaseType === "actual"
                    ? "Fiili"
                    : "-"}
                </td>
                <td className="border px-3 py-2">
                  {m.invoiceNo || "-"}
                </td>
                <td className="border px-3 py-2">
                  {m.supplierName || "-"}
                </td>
                <td className="border px-3 py-2 text-center">
                  {m.qty}
                </td>
                <td className="border px-3 py-2 text-right">
                  {fmtMoney(m.unitCost)} ₸
                </td>
                <td className="border px-3 py-2 text-right">
                  {fmtMoney(m.totalCost)} ₸
                </td>
              </tr>
            ))}

            {movements.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="border px-3 py-6 text-center text-gray-500"
                >
                  Stok hareketi bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
