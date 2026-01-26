// app/satissitok/admin/cari/[cariId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { listCariTransactions } from "../services/cariTransactions";

function formatDate(d) {
  if (!d) return "-";
  const dt = d.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString("tr-TR");
}

export default function CariEkstrePage() {
  const { cariId } = useParams();

  const [cari, setCari] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Cari bilgisi
  useEffect(() => {
    const loadCari = async () => {
      const ref = doc(db, "caris", cariId);
      const snap = await getDoc(ref);
      setCari(snap.exists() ? snap.data() : null);
    };
    loadCari();
  }, [cariId]);

  // Hareketler
  const loadTransactions = async () => {
    setLoading(true);
    const data = await listCariTransactions({
      cariId,
      fromDate,
      toDate,
    });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line
  }, [cariId]);

  // Koşan bakiye
  const rowsWithBalance = useMemo(() => {
    let balance = 0;
    return rows.map((r) => {
      balance += Number(r.debit || 0) - Number(r.credit || 0);
      return { ...r, balance };
    });
  }, [rows]);

  if (!cari) {
    return <div className="p-6">Cari bulunamadı.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold">Cari Ekstre</h1>
        <div className="text-sm text-gray-600 mt-1">
          <strong>{cari.firm}</strong> — {cari.type}
        </div>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm mb-1">Başlangıç</label>
          <input
            type="date"
            className="border px-3 py-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Bitiş</label>
          <input
            type="date"
            className="border px-3 py-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button
          onClick={loadTransactions}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Filtrele
        </button>
      </div>

      {/* Tablo */}
      {loading ? (
        <div>Yükleniyor…</div>
      ) : (
        <table className="w-full border border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2">Tarih</th>
              <th className="border px-2 py-2">İşlem Türü</th>
              <th className="border px-2 py-2">Belge No</th>
              <th className="border px-2 py-2 text-right">Borç</th>
              <th className="border px-2 py-2 text-right">Alacak</th>
              <th className="border px-2 py-2 text-right">Bakiye</th>
              <th className="border px-2 py-2">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithBalance.map((r) => (
              <tr key={r.id}>
                <td className="border px-2 py-1 text-center">
                  {formatDate(r.operationDate)}
                </td>
                <td className="border px-2 py-1 text-center">
                  {r.operationType}
                </td>
                <td className="border px-2 py-1 text-center">
                  {r.documentNo || "-"}
                </td>
                <td className="border px-2 py-1 text-right">
                  {r.debit ? r.debit.toLocaleString() : "-"}
                </td>
                <td className="border px-2 py-1 text-right">
                  {r.credit ? r.credit.toLocaleString() : "-"}
                </td>
                <td className="border px-2 py-1 text-right font-medium">
                  {r.balance.toLocaleString()}
                </td>
                <td className="border px-2 py-1">
                  {r.description || ""}
                </td>
              </tr>
            ))}

            {rowsWithBalance.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="border px-3 py-6 text-center text-gray-500"
                >
                  Hareket bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
