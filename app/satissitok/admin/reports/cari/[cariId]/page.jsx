"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import {
  buildRunningBalanceRows,
  listCariTransactions,
  summarizeCariTransactions,
} from "@/app/satissitok/admin/cari/services/cariTransactions";

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
  return d.toLocaleString("tr-TR");
}

export default function CariDetailPage() {
  const { cariId } = useParams();

  const [cari, setCari] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cariId]);

  async function loadData() {
    setLoading(true);

    try {
      const cariSnap = await getDoc(doc(db, "caris", cariId));
      setCari(cariSnap.exists() ? cariSnap.data() : null);

      const txRows = await listCariTransactions({ cariId });
      setRows(txRows);
    } finally {
      setLoading(false);
    }
  }

  const runningRows = useMemo(() => buildRunningBalanceRows(rows), [rows]);
  const summary = useMemo(() => summarizeCariTransactions(rows), [rows]);

  if (loading) return <div className="p-6">Yukleniyor...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Cari Detayi</h1>

      <div className="border p-4 space-y-1">
        <div>
          <b>Firma:</b> {cari?.firm || "-"}
        </div>
        <div>
          <b>Telefon:</b> {cari?.mobile || "-"}
        </div>
        <div>
          <b>Para Birimi:</b> {cari?.currency || "KZT"}
        </div>
        <div>
          <b>Net Bakiye:</b> {money(summary.balance)}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1">Tarih</th>
              <th className="border p-1">Yon</th>
              <th className="border p-1">Islem</th>
              <th className="border p-1">Belge</th>
              <th className="border p-1 text-right">Borc</th>
              <th className="border p-1 text-right">Alacak</th>
              <th className="border p-1 text-right">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {runningRows.map((r, i) => (
              <tr key={r.id || i}>
                <td className="border p-1">{formatDate(r.operationDate)}</td>
                <td className="border p-1">
                  {r.direction === "debit"
                    ? "Borc"
                    : r.direction === "credit"
                    ? "Alacak"
                    : "-"}
                </td>
                <td className="border p-1">{r.operationType || "-"}</td>
                <td className="border p-1">{r.documentNo || r.refId || "-"}</td>
                <td className="border p-1 text-right">{r.debit ? money(r.debit) : "-"}</td>
                <td className="border p-1 text-right">{r.credit ? money(r.credit) : "-"}</td>
                <td className="border p-1 text-right font-semibold">{money(r.balance)}</td>
              </tr>
            ))}
            {runningRows.length === 0 && (
              <tr>
                <td className="border p-3 text-center text-gray-500" colSpan={7}>
                  Kayit bulunamadi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
