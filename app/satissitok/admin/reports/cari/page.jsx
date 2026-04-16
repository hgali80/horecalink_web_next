"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import {
  listAllCariTransactions,
  normalizeCariTransaction,
  summarizeCariTransactions,
} from "@/app/satissitok/admin/cari/services/cariTransactions";

function money(n) {
  return Number(n || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(value) {
  if (!value) return "-";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("tr-TR");
}

export default function CariReportPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [carisMap, setCarisMap] = useState({});

  const [filterType, setFilterType] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    loadCaris();
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCaris() {
    const snap = await getDocs(collection(db, "caris"));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = d.data().firm || "-";
    });
    setCarisMap(map);
  }

  async function loadReport() {
    setLoading(true);

    try {
      let start;
      let end = new Date();

      if (filterType === "today") {
        start = startOfToday();
      } else if (filterType === "month") {
        start = startOfMonth();
      } else {
        if (!fromDate || !toDate) {
          alert("Tarih araligini sec");
          return;
        }
        start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
      }

      const allRows = await listAllCariTransactions();
      const grouped = {};

      for (const row of allRows) {
        const tx = normalizeCariTransaction(row);
        if (!tx.cariId || !tx.operationDate) continue;
        if (tx.operationDate < start || tx.operationDate > end) continue;

        if (!grouped[tx.cariId]) grouped[tx.cariId] = [];
        grouped[tx.cariId].push(tx);
      }

      const table = Object.entries(grouped)
        .map(([cariId, txRows]) => {
          const summary = summarizeCariTransactions(txRows);
          return {
            cariId,
            ...summary,
          };
        })
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

      setRows(table);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Yukleniyor...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cari Raporu</h1>
          <p className="mt-1 text-sm text-gray-600">Cari hareketleri ve bakiye ozetleri</p>
        </div>
        <Link
          href="/satissitok/admin/reports/cari-aging"
          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cari Yaslandirma Raporu
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 items-end border p-4">
        <div>
          <label className="block text-sm">Filtre</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border p-2"
          >
            <option value="today">Bugun</option>
            <option value="month">Bu Ay</option>
            <option value="custom">Ozel Aralik</option>
          </select>
        </div>

        {filterType === "custom" && (
          <>
            <div>
              <label className="block text-sm">Baslangic</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border p-2"
              />
            </div>
            <div>
              <label className="block text-sm">Bitis</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border p-2"
              />
            </div>
          </>
        )}

        <button
          onClick={loadReport}
          className="px-4 py-2 bg-black text-white rounded"
        >
          Uygula
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1">Cari</th>
              <th className="border p-1 text-right">Borc</th>
              <th className="border p-1 text-right">Alacak</th>
              <th className="border p-1 text-right">Bakiye</th>
              <th className="border p-1">Son Hareket</th>
              <th className="border p-1 text-center">Hareket</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cariId}>
                <td className="border p-1">{carisMap[r.cariId] || r.cariId}</td>
                <td className="border p-1 text-right">{money(r.debit)}</td>
                <td className="border p-1 text-right">{money(r.credit)}</td>
                <td
                  className={`border p-1 text-right font-semibold ${
                    r.balance > 0 ? "text-red-600" : r.balance < 0 ? "text-emerald-700" : ""
                  }`}
                >
                  {money(r.balance)}
                </td>
                <td className="border p-1 text-center">{formatDate(r.lastMovementDate)}</td>
                <td className="border p-1 text-center">{r.count}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="border p-3 text-center text-gray-500">
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
