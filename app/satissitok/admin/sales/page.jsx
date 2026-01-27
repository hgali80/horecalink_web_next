// app/satissitok/admin/sales/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/firebase";

function formatDate(ts) {
  if (!ts?.toDate) return "-";
  return ts.toDate().toLocaleDateString();
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [carisMap, setCarisMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // 🔹 Cariler
    const carisSnap = await getDocs(collection(db, "caris"));
    const cmap = {};
    carisSnap.forEach((d) => {
      cmap[d.id] = d.data().firm || "-";
    });
    setCarisMap(cmap);

    // 🔹 Sales
    const q = query(
      collection(db, "sales"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    const rows = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    setSales(rows);
    setLoading(false);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Satışlar</h1>

        <Link
          href="/satissitok/admin/sales/new"
          className="px-4 py-2 rounded bg-black text-white text-sm"
        >
          Yeni Satış
        </Link>
      </div>

      {loading ? (
        <div>Yükleniyor…</div>
      ) : sales.length === 0 ? (
        <div>Henüz satış yok</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">No</th>
                <th className="border px-2 py-1">Tarih</th>
                <th className="border px-2 py-1">Cari</th>
                <th className="border px-2 py-1">Tip</th>
                <th className="border px-2 py-1">Toplam</th>
                <th className="border px-2 py-1">Durum</th>
                <th className="border px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="border px-2 py-1">
                    {s.saleNo}
                  </td>
                  <td className="border px-2 py-1">
                    {formatDate(s.createdAt)}
                  </td>
                  <td className="border px-2 py-1">
                    {carisMap[s.cariId] || "-"}
                  </td>
                  <td className="border px-2 py-1">
                    {s.saleType === "official"
                      ? "Resmi"
                      : "Fiili"}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {formatMoney(s.grossTotal)}
                  </td>
                  <td className="border px-2 py-1">
                    {s.status}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <Link
                      href={`/satissitok/admin/sales/${s.id}`}
                      className="underline"
                    >
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
