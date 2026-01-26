// app/satissitok/admin/cari/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listCaris } from "./services/cariService";

export default function CariListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await listCaris();
      setRows(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cari Kartlar</h1>
        <Link
          href="/satissitok/admin/cari/new"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          + Yeni Cari
        </Link>
      </div>

      <table className="w-full border border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Firma</th>
            <th className="border px-3 py-2">Tür</th>
            <th className="border px-3 py-2">BIN</th>
            <th className="border px-3 py-2">Telefon</th>
            <th className="border px-3 py-2">Durum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="border px-3 py-2 font-medium">
                <Link
                  href={`/satissitok/admin/cari/${r.id}`}
                  className="text-blue-600 underline"
                >
                  {r.firm}
                </Link>
              </td>
              <td className="border px-3 py-2 text-center">
                {r.type}
              </td>
              <td className="border px-3 py-2 text-center">
                {r.bin || "-"}
              </td>
              <td className="border px-3 py-2 text-center">
                {r.mobile || "-"}
              </td>
              <td className="border px-3 py-2 text-center">
                {r.isActive ? "Aktif" : "Pasif"}
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="border px-3 py-6 text-center text-gray-500"
              >
                Cari kart bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
