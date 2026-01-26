//app/satissitok/admin/stock/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/firebase";

function fmtMoney(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AdminStockPage() {
  const [products, setProducts] = useState([]);
  const [balances, setBalances] = useState({});
  const [movementCounts, setMovementCounts] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // 🔹 Ürünler
  useEffect(() => {
    const loadProducts = async () => {
      const snap = await getDocs(collection(db, "products"));
      setProducts(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    };
    loadProducts();
  }, []);

  // 🔹 Stok bakiyeleri
  useEffect(() => {
    const loadBalances = async () => {
      const snap = await getDocs(collection(db, "stock_balances"));
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setBalances(map);
    };
    loadBalances();
  }, []);

  // 🔹 Stok hareket sayıları (SEÇENEK A)
  useEffect(() => {
    const loadMovements = async () => {
      const snap = await getDocs(collection(db, "stock_movements"));
      const counts = {};
      snap.docs.forEach((d) => {
        const { productId } = d.data();
        if (!productId) return;
        counts[productId] = (counts[productId] || 0) + 1;
      });
      setMovementCounts(counts);
      setLoading(false);
    };
    loadMovements();
  }, []);

  const rows = useMemo(() => {
    return products
      .map((p) => {
        const b = balances[p.id] || {};
        return {
          id: p.id,
          name: p.name || "-",
          unit: p.unit || "-",

          officialQty: b?.official?.qty || 0,
          officialAvg: b?.official?.avgCost || 0,

          actualQty: b?.actual?.qty || 0,
          actualAvg: b?.actual?.avgCost || 0,

          movementCount: movementCounts[p.id] || 0,
        };
      })
      // 🔍 Arama
      .filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
      )
      // 🔽 Hareket sayısına göre sırala
      .sort((a, b) => b.movementCount - a.movementCount);
  }, [products, balances, movementCounts, search]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Stok Durumu</h1>

      {/* 🔍 Arama */}
      <input
        type="text"
        placeholder="Ürün ara (örn: tuvalet)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border px-3 py-2 rounded"
      />

      <div className="overflow-x-auto">
        <table className="w-full border border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">Ürün</th>
              <th className="border px-3 py-2">Birim</th>

              <th className="border px-3 py-2">Resmi Stok</th>
              <th className="border px-3 py-2">Resmi Ort. Maliyet</th>

              <th className="border px-3 py-2">Fiili Stok</th>
              <th className="border px-3 py-2">Fiili Ort. Maliyet</th>

              <th className="border px-3 py-2">Hareket</th>
              <th className="border px-3 py-2">Detay</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2 font-medium">
                  {r.name}
                </td>

                <td className="border px-3 py-2 text-center">
                  {r.unit}
                </td>

                <td className="border px-3 py-2 text-center">
                  {r.officialQty}
                </td>

                <td className="border px-3 py-2 text-right">
                  {fmtMoney(r.officialAvg)} ₸
                </td>

                <td className="border px-3 py-2 text-center">
                  {r.actualQty}
                </td>

                <td className="border px-3 py-2 text-right">
                  {fmtMoney(r.actualAvg)} ₸
                </td>

                <td className="border px-3 py-2 text-center">
                  {r.movementCount}
                </td>

                <td className="border px-3 py-2 text-center">
                  <Link
                    href={`/satissitok/admin/stock/${r.id}`}
                    className="text-blue-600 underline"
                  >
                    Detay
                  </Link>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="border px-3 py-6 text-center text-gray-500"
                >
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
