//app/satissitok/admin/reports/cari/page.jsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

function money(n) {
  return Number(n || 0).toLocaleString("ru-RU", {
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

    let start;
    let end = new Date();

    if (filterType === "today") {
      start = startOfToday();
    } else if (filterType === "month") {
      start = startOfMonth();
    } else {
      if (!fromDate || !toDate) {
        alert("Tarih aralığını seç");
        setLoading(false);
        return;
      }
      start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
    }

    const q = query(
      collection(db, "cari_transactions"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end))
    );

    const snap = await getDocs(q);

    const map = {};

    snap.forEach((doc) => {
      const t = doc.data();
      const cid = t.cariId;
      if (!map[cid]) {
        map[cid] = { debit: 0, credit: 0 };
      }

      const amt = Number(t.amount || 0);
      if (t.type === "debit") map[cid].debit += amt;
      if (t.type === "credit") map[cid].credit += amt;
    });

    const table = Object.keys(map).map((cid) => {
      const d = map[cid];
      return {
        cariId: cid,
        debit: d.debit,
        credit: d.credit,
        balance: d.debit - d.credit,
      };
    });

    setRows(table);
    setLoading(false);
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Cari Raporu</h1>

      {/* FİLTRE */}
      <div className="flex flex-wrap gap-4 items-end border p-4">
        <div>
          <label className="block text-sm">Filtre</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border p-2"
          >
            <option value="today">Bugün</option>
            <option value="month">Bu Ay</option>
            <option value="custom">Özel Aralık</option>
          </select>
        </div>

        {filterType === "custom" && (
          <>
            <div>
              <label className="block text-sm">Başlangıç</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border p-2"
              />
            </div>
            <div>
              <label className="block text-sm">Bitiş</label>
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

      {/* TABLO */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1">Cari</th>
              <th className="border p-1 text-right">Borç</th>
              <th className="border p-1 text-right">Alacak</th>
              <th className="border p-1 text-right">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cariId}>
                <td className="border p-1">
                  {carisMap[r.cariId] || r.cariId}
                </td>
                <td className="border p-1 text-right">
                  {money(r.debit)}
                </td>
                <td className="border p-1 text-right">
                  {money(r.credit)}
                </td>
                <td
                  className={`border p-1 text-right ${
                    r.balance > 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {money(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
