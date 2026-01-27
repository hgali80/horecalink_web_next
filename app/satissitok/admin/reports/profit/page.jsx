// app/satissitok/admin/reports/profit/page.jsx
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

export default function ProfitReportPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ revenue: 0, cost: 0, profit: 0 });

  const [filterType, setFilterType] = useState("today"); // today | month | custom
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
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end))
    );

    const snap = await getDocs(q);

    let totalRevenue = 0;
    let totalCost = 0;
    const table = [];

    snap.forEach((sdoc) => {
      const s = sdoc.data();

      const revenue = Number(s.grossTotal || 0);
      const cost = Number(s.totalCost || 0); // ✅ cache
      const profit = Number(s.grossProfit ?? (revenue - cost));

      totalRevenue += revenue;
      totalCost += cost;

      table.push({
        saleNo: s.saleNo,
        saleType: s.saleType,
        revenue,
        cost,
        profit,
      });
    });

    setRows(table);
    setSummary({
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalRevenue - totalCost,
    });

    setLoading(false);
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Kâr Raporu</h1>

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

        <button onClick={loadReport} className="px-4 py-2 bg-black text-white rounded">
          Uygula
        </button>
      </div>

      {/* ÖZET */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Toplam Gelir" value={money(summary.revenue)} />
        <Card title="Toplam Maliyet" value={money(summary.cost)} />
        <Card title="Brüt Kâr" value={money(summary.profit)} />
      </div>

      {/* DETAY */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1">Satış No</th>
              <th className="border p-1">Tip</th>
              <th className="border p-1 text-right">Gelir</th>
              <th className="border p-1 text-right">Maliyet</th>
              <th className="border p-1 text-right">Kâr</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="border p-1">{r.saleNo}</td>
                <td className="border p-1">{r.saleType === "official" ? "Resmi" : "Fiili"}</td>
                <td className="border p-1 text-right">{money(r.revenue)}</td>
                <td className="border p-1 text-right">{money(r.cost)}</td>
                <td className={`border p-1 text-right ${r.profit < 0 ? "text-red-600" : ""}`}>
                  {money(r.profit)}
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
