"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { listCaris } from "./services/cariService";
import { summarizeAllCariBalances } from "./services/cariTransactions";

function money(n) {
  return Number(n || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("tr-TR");
}

export default function CariListPage() {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, balancesMap] = await Promise.all([
          listCaris(),
          summarizeAllCariBalances(),
        ]);

        setRows(
          data.map((row) => ({
            ...row,
            ledger: balancesMap[row.id] || {
              debit: 0,
              credit: 0,
              balance: 0,
              lastMovementDate: null,
              count: 0,
            },
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <div className="p-6">Yukleniyor...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
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
          aria-label="Satis/Stok Ana Sayfa"
          title="Satis/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

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
            <th className="border px-3 py-2">Tur</th>
            <th className="border px-3 py-2">BIN</th>
            <th className="border px-3 py-2">Telefon</th>
            <th className="border px-3 py-2 text-right">Borc</th>
            <th className="border px-3 py-2 text-right">Alacak</th>
            <th className="border px-3 py-2 text-right">Bakiye</th>
            <th className="border px-3 py-2">Son Hareket</th>
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
              <td className="border px-3 py-2 text-center">{r.type}</td>
              <td className="border px-3 py-2 text-center">{r.bin || "-"}</td>
              <td className="border px-3 py-2 text-center">{r.mobile || "-"}</td>
              <td className="border px-3 py-2 text-right">{money(r.ledger?.debit)}</td>
              <td className="border px-3 py-2 text-right">{money(r.ledger?.credit)}</td>
              <td
                className={`border px-3 py-2 text-right font-semibold ${
                  Number(r.ledger?.balance || 0) > 0
                    ? "text-red-600"
                    : Number(r.ledger?.balance || 0) < 0
                    ? "text-emerald-700"
                    : ""
                }`}
              >
                {money(r.ledger?.balance)}
              </td>
              <td className="border px-3 py-2 text-center">
                {formatDate(r.ledger?.lastMovementDate)}
              </td>
              <td className="border px-3 py-2 text-center">
                {r.isActive ? "Aktif" : "Pasif"}
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="border px-3 py-6 text-center text-gray-500">
                Cari kart bulunamadi.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
