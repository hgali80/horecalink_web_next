//app/satissitok/admin/reports/vat/page.jsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
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

function normalizeDateRange(filterType, fromDate, toDate) {
  let start;
  let end = new Date();

  if (filterType === "today") {
    start = startOfToday();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (filterType === "month") {
    start = startOfMonth();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // custom
  if (!fromDate || !toDate) return null;

  start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export default function VatReportPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ net: 0, vat: 0, gross: 0 });
  const [error, setError] = useState("");

  const [filterType, setFilterType] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReport() {
    setLoading(true);
    setError("");

    const range = normalizeDateRange(filterType, fromDate, toDate);
    if (!range) {
      alert("Tarih aralığını seç");
      setLoading(false);
      return;
    }

    const { start, end } = range;

    try {
      const q = query(
        collection(db, "sales"),
        where("status", "==", "completed"),
        where("saleType", "==", "official"),
        where("createdAt", ">=", Timestamp.fromDate(start)),
        where("createdAt", "<=", Timestamp.fromDate(end)),
        orderBy("createdAt", "desc")
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
    } catch (e) {
      // Index yoksa sayfa kilitlenmesin; net hata göster
      const msg = String(e?.message || e || "Bilinmeyen hata");
      setError(msg);

      // console linki genelde message içinde olur (create index)
      // burada sadece kullanıcıya gösteriyoruz.
      setRows([]);
      setSummary({ net: 0, vat: 0, gross: 0 });
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">KDV Raporu</h1>

      {/* HATA */}
      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 p-3 rounded text-sm">
          <div className="font-semibold mb-1">Firestore Hatası</div>
          <div className="whitespace-pre-wrap">{error}</div>
          <div className="mt-2">
            Büyük ihtimalle <b>composite index</b> eksik. Konsoldaki hata linkine
            tıklayıp “Create index” oluştur.
          </div>
        </div>
      )}

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
                <td className="border p-1 text-right">{money(r.net)}</td>
                <td className="border p-1 text-right">{money(r.vat)}</td>
                <td className="border p-1 text-right">{money(r.gross)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="border p-3 text-center text-gray-500" colSpan={4}>
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

function Card({ title, value }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}