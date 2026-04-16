//app/satissitok/admin/stock/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { db } from "@/firebase";
import {
  buildLatestCostIndex,
  listProductCostEntries,
} from "@/app/satissitok/services/inventoryCostService";

function fmtMoney(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function sumBucketQty(docData, bucketKey) {
  const warehouses = docData?.warehouses;
  if (warehouses && typeof warehouses === "object") {
    return Object.values(warehouses).reduce(
      (s, wh) => s + num(wh?.[bucketKey]?.qty),
      0
    );
  }
  return num(docData?.[bucketKey]?.qty);
}

function sumBucketAvgCost(docData, bucketKey) {
  // UI amaçlı basit gösterim: ilk bulunan avgCost (ağırlıklı ortalama sonraki adım)
  const warehouses = docData?.warehouses;
  if (warehouses && typeof warehouses === "object") {
    for (const wh of Object.values(warehouses)) {
      const v = wh?.[bucketKey]?.avgCost;
      if (Number.isFinite(Number(v))) return num(v);
    }
  }
  return num(docData?.[bucketKey]?.avgCost);
}

export default function AdminStockPage() {
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [balances, setBalances] = useState({});
  const [movementCounts, setMovementCounts] = useState({});
  const [latestCosts, setLatestCosts] = useState({});
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
      const [snap, costEntries] = await Promise.all([
        getDocs(collection(db, "stock_movements")),
        listProductCostEntries(),
      ]);
      const counts = {};
      snap.docs.forEach((d) => {
        const { productId } = d.data();
        if (!productId) return;
        counts[productId] = (counts[productId] || 0) + 1;
      });
      const latest = {};
      Object.entries(buildLatestCostIndex(costEntries)).forEach(([key, entry]) => {
        if (!key.endsWith("__default")) return;
        latest[key.replace("__default", "")] = entry;
      });
      setMovementCounts(counts);
      setLatestCosts(latest);
      setLoading(false);
    };
    loadMovements();
  }, []);

  const rows = useMemo(() => {
    return (
      products
        .map((p) => {
          const b = balances[p.id] || {};
          return {
            id: p.id,
            name: p.name || "-",
            unit: p.unit || "-",
            salePrice: num(p.price || 0),

            officialQty: sumBucketQty(b, "official"),
            officialAvg: sumBucketAvgCost(b, "official"),

            actualQty: sumBucketQty(b, "actual"),
            actualAvg: sumBucketAvgCost(b, "actual"),
            lastPurchaseCost: num(latestCosts[p.id]?.grossUnitCost || 0),

            movementCount: movementCounts[p.id] || 0,
          };
        })
        // 🔍 Arama
        .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
        // 🔽 Hareket sayısına göre sırala
        .sort((a, b) => b.movementCount - a.movementCount)
    );
  }, [products, balances, movementCounts, latestCosts, search]);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Yükleniyor...</div>;
  }

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

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Stok Durumu</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/satissitok/admin/stock/movements"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Hareket Listesi
          </Link>
          <Link
            href="/satissitok/admin/stock/movements/new"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Yeni Stok Hareketi
          </Link>
        </div>
      </div>

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
              <th className="border px-3 py-2">Satis Fiyati</th>
              <th className="border px-3 py-2">Son Alis</th>

              <th className="border px-3 py-2">Hareket</th>
              <th className="border px-3 py-2">Detay</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2 font-medium">{r.name}</td>

                <td className="border px-3 py-2 text-center">{r.unit}</td>

                <td className="border px-3 py-2 text-center">{r.officialQty}</td>

                <td className="border px-3 py-2 text-right">{fmtMoney(r.officialAvg)} ₸</td>

                <td className="border px-3 py-2 text-center">{r.actualQty}</td>

                <td className="border px-3 py-2 text-right">{fmtMoney(r.actualAvg)} ₸</td>

                <td className="border px-3 py-2 text-right">{fmtMoney(r.salePrice)} â‚¸</td>

                <td className="border px-3 py-2 text-right">{fmtMoney(r.lastPurchaseCost)} â‚¸</td>

                <td className="border px-3 py-2 text-center">{r.movementCount}</td>

                <td className="border px-3 py-2 text-center">
                  <Link href={`/satissitok/admin/stock/${r.id}`} className="text-blue-600 underline">
                    Detay
                  </Link>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="border px-3 py-6 text-center text-gray-500">
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
