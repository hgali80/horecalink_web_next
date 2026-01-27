// app/satissitok/admin/sales/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { AlertTriangle } from "lucide-react";

export default function SalesListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [saleType, setSaleType] = useState(""); // official | actual | ""
  const [platformId, setPlatformId] = useState(""); // kaspi | ozon | ...
  
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = query(collection(db, "sales"), orderBy("createdAt", "desc"));

      if (saleType) q = query(q, where("saleType", "==", saleType));
      if (platformId) q = query(q, where("saleChannel", "==", platformId));

      const snap = await getDocs(q);
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, [saleType, platformId]);

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="flex gap-4 items-center">
        <select
          className="border p-2"
          value={saleType}
          onChange={(e) => setSaleType(e.target.value)}
        >
          <option value="">Tümü</option>
          <option value="official">Resmi</option>
          <option value="actual">Fiili</option>
        </select>

        <select
          className="border p-2"
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
        >
          <option value="">Tüm Platformlar</option>
          <option value="kaspi">Kaspi</option>
          <option value="ozon">Ozon</option>
          <option value="showroom">Showroom</option>
          <option value="online">Online</option>
        </select>

        <Link
          href="/satissitok/admin/sales/new"
          className="ml-auto border px-3 py-2 rounded"
        >
          + Yeni Satış
        </Link>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Fatura No</th>
              <th className="p-2">Tür</th>
              <th className="p-2">Platform</th>
              <th className="p-2">Cari</th>
              <th className="p-2">Tarih</th>
              <th className="p-2 text-right">Toplam</th>
              <th className="p-2 text-center">!</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-2">
                  <Link href={`/satissitok/admin/sales/${r.id}`} className="underline">
                    {r.invoiceNo}
                  </Link>
                </td>
                <td className="p-2">
                  {r.saleType === "official" ? "Resmi" : "Fiili"}
                </td>
                <td className="p-2">{r.saleChannel}</td>
                <td className="p-2">{r.cariId || "—"}</td>
                <td className="p-2">
                  {r.invoiceDate?.toDate
                    ? r.invoiceDate.toDate().toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-2 text-right">
                  {Number(r.grossTotal || 0).toFixed(2)}
                </td>
                <td className="p-2 text-center">
                  {r.hasNegativeStock && (
                    <AlertTriangle size={16} className="text-red-600 inline" />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-400">
                  Kayıt yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
