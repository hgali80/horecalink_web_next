// app/satissitok/admin/reports/pl/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Home, RefreshCw } from "lucide-react";
import { loadPLReport } from "@/app/satissitok/services/plReportService";

function money(n) {
  return Number(n || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearISO() {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

export default function PLReportPage() {
  const [period, setPeriod] = useState("month"); // day | week | month | year
  const [fromISO, setFromISO] = useState(startOfYearISO());
  const [toISO, setToISO] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const totals = data?.totals;

  async function run() {
    setLoading(true);
    try {
      const r = await loadPLReport({
        fromISO,
        toISO,
        period,
        dateField: "documentDate",
      });
      setData(r);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Rapor hatası");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => data?.rows || [], [data]);

  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900">
      <main className="p-8 max-w-[1400px] mx-auto w-full">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link
            href="/satissitok/admin/reports"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Raporlar
          </Link>

          <Link
            href="/satissitok/admin"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-slate-50"
          >
            <Home className="w-4 h-4" />
            Ana Sayfa
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              className="px-3 py-2 rounded-lg border bg-white"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="day">Günlük</option>
              <option value="week">Haftalık</option>
              <option value="month">Aylık</option>
              <option value="year">Yıllık</option>
            </select>

            <input
              type="date"
              className="px-3 py-2 rounded-lg border bg-white"
              value={fromISO}
              onChange={(e) => setFromISO(e.target.value)}
            />
            <input
              type="date"
              className="px-3 py-2 rounded-lg border bg-white"
              value={toISO}
              onChange={(e) => setToISO(e.target.value)}
            />

            <button
              onClick={run}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Yenile
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-semibold mb-4">Kar / Zarar (P&L)</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <Card title="Satış (Brüt)" value={money(totals?.sales_gross)} />
          <Card title="COGS (Maliyet)" value={money(totals?.cogs_total)} />
          <Card title="Brüt Kâr" value={money(totals?.gross_profit)} />
          <Card title="Brüt Marj %" value={`${Number(totals?.gross_margin || 0).toFixed(2)}%`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <Card
            title="Satış Resmi (Brüt)"
            value={money(totals?.sales_official_gross)}
            sub={`KDV: ${money(totals?.sales_official_vat)}`}
          />
          <Card
            title="Satış Fiili (Brüt)"
            value={money(totals?.sales_actual_gross)}
            sub="KDV: 0"
          />
          <Card
            title="KDV Durumu (Çıkış - Giriş)"
            value={money(totals?.vat_payable)}
            sub={`Çıkış: ${money(totals?.vat_out)} | Giriş: ${money(totals?.vat_in)}`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          <Card
            title="Satınalma Resmi (Brüt)"
            value={money(totals?.purchases_official_gross)}
            sub={`KDV: ${money(totals?.purchases_official_vat)}`}
          />
          <Card
            title="Satınalma Fiili (Brüt)"
            value={money(totals?.purchases_actual_gross)}
            sub="KDV: 0"
          />
        </div>

        {/* Table */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b font-medium">
            Dönem Kırılımı ({period})
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <Th>Dönem</Th>
                  <Th>Satış Brüt</Th>
                  <Th>COGS</Th>
                  <Th>Brüt Kâr</Th>
                  <Th>Marj %</Th>
                  <Th>Satınalma Brüt</Th>
                  <Th>KDV (Ç-G)</Th>
                  <Th>İade Brüt</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t">
                    <Td className="font-medium">{r.key}</Td>
                    <Td>{money(r.sales_gross)}</Td>
                    <Td>{money(r.cogs_total)}</Td>
                    <Td className={r.gross_profit < 0 ? "text-red-600" : "text-emerald-700"}>
                      {money(r.gross_profit)}
                    </Td>
                    <Td>{Number(r.gross_margin || 0).toFixed(2)}%</Td>
                    <Td>{money(r.purchases_official_gross + r.purchases_actual_gross)}</Td>
                    <Td>{money(r.vat_payable)}</Td>
                    <Td>{money(r.returns_gross)}</Td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <Td colSpan={8} className="py-6 text-center text-slate-500">
                      Kayıt bulunamadı.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6 text-sm text-slate-600">
          <ul className="list-disc pl-5 space-y-1">
            <li>COGS ve Brüt Kâr, satış belgelerinde hesaplanan <code>costTotalUsed</code> / <code>profitTotal</code> üzerinden gelir.</li>
            <li>İadeler, döneme negatif etki edecek şekilde terslenir (status: returned).</li>
            <li>KDV Durumu = Satış KDV (çıkış) - Satınalma KDV (giriş)</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

function Card({ title, value, sub }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {sub ? <div className="text-xs text-slate-500 mt-2">{sub}</div> : null}
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 text-xs font-semibold text-slate-600">{children}</th>;
}
function Td({ children, className = "", colSpan }) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 ${className}`}>
      {children}
    </td>
  );
}