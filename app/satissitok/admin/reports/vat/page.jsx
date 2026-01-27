//app/satissitok/admin/reports/vat/page.jsx
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

export default function VatReportPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    net: 0,
    vat: 0,
    gross: 0,
  });

  const [filterType, setFilterType] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    loadReport();
  }, []);

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
      collection(db, "sales"),
      where("status", "==", "completed"),
      where("saleType", "==", "official"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end))
    );

    const snap = await getDocs(q);

    let net = 0;
    let vat = 0;
    let gross = 0;
    const table = [];

    snap.forEach((doc) => {
      const s = doc.data();

      net += Number(s.netTotal || 0);
      vat += Number(s.vatTotal || 0);
      gross += Number(s.grossTotal || 0);

      table.push({
        saleNo: s.saleNo,
        net: s.netTotal,
        vat: s.vatTotal,
        gross: s.grossTotal,
      });
    });

    setSummary({ net, vat, gross });
    setRows(table);
    setLoading(false);
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">KDV Raporu</h1>

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

      {/* ÖZET */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Net Tutar" value={money(summary.net)} />
        <Card title="KDV" value={money(summary.vat)} />
        <Card title="Brüt Toplam" value={money(summary.gross)} />
      </div>

      {/* DETAY */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1">Satış No</th>
              <th className="border p-1 text-right">Net</th>
              <th className="border p-1 text-right">KDV</th>
              <th className="border p-1 text-right">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="border p-1">{r.saleNo}</td>
                <td className="border p-1 text-right">
                  {money(r.net)}
                </td>
                <td className="border p-1 text-right">
                  {money(r.vat)}
                </td>
                <td className="border p-1 text-right">
                  {money(r.gross)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
