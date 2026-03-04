// app/satissitok/admin/finance/page.jsx
"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Home,
  Wallet,
  Landmark,
  ReceiptText,
  BadgeDollarSign,
  RefreshCw,
  TrendingUp,
  Percent,
  Boxes,
  HandCoins,
  CreditCard,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadFinanceDashboard } from "@/app/satissitok/services/financeDashboardService";

function money(n) {
  return Number(n || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function startOfYearISO() {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

export default function FinanceDashboard() {
  const router = useRouter();

  const [fromISO, setFromISO] = useState(isoDaysAgo(30));
  const [toISO, setToISO] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState(null);

  async function run() {
    setLoading(true);
    try {
      const res = await loadFinanceDashboard({ fromISO, toISO, dateField: "documentDate" });
      setKpis(res.kpis);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Finance dashboard hatası");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const netProfitColor =
    (kpis?.net_profit ?? 0) < 0 ? "text-red-600" : "text-emerald-700";

  const presets = useMemo(
    () => [
      { label: "Bugün", from: todayISO(), to: todayISO() },
      { label: "7 Gün", from: isoDaysAgo(7), to: todayISO() },
      { label: "30 Gün", from: isoDaysAgo(30), to: todayISO() },
      { label: "Yıl Başından", from: startOfYearISO(), to: todayISO() },
    ],
    []
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* top nav */}
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
          aria-label="Satış/Stok Ana Sayfa"
          title="Satış/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="px-3 py-2 rounded-xl bg-white border border-gray-200"
            value={fromISO}
            onChange={(e) => setFromISO(e.target.value)}
          />
          <input
            type="date"
            className="px-3 py-2 rounded-xl bg-white border border-gray-200"
            value={toISO}
            onChange={(e) => setToISO(e.target.value)}
          />

          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Yenile
          </button>
        </div>
      </div>

      {/* title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finans</h1>
        <div className="text-sm text-gray-600 mt-1">
          Net kâr / KDV / stok değeri / açık alacak-borç tek ekran
        </div>
      </div>

      {/* presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setFromISO(p.from);
              setToISO(p.to);
            }}
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          title="Ciro (Net)"
          value={money(kpis?.sales_net)}
          icon={<TrendingUp size={18} />}
        />
        <Kpi
          title="Brüt Kâr"
          value={money(kpis?.gross_profit)}
          icon={<TrendingUp size={18} />}
          valueClass={(kpis?.gross_profit ?? 0) < 0 ? "text-red-600" : "text-emerald-700"}
          sub={`Brüt Marj: ${Number(kpis?.gross_margin || 0).toFixed(2)}%`}
        />
        <Kpi
          title="Net Kâr"
          value={money(kpis?.net_profit)}
          icon={<TrendingUp size={18} />}
          valueClass={netProfitColor}
          sub={`Net Marj: ${Number(kpis?.net_margin || 0).toFixed(2)}%`}
        />
        <Kpi
          title="KDV (Çıkış - Giriş)"
          value={money(kpis?.vat_payable)}
          icon={<Percent size={18} />}
          sub={`Çıkış: ${money(kpis?.vat_out)} | Giriş: ${money(kpis?.vat_in)}`}
        />

        <Kpi
          title="Gider (OPEX Net)"
          value={money(kpis?.opex_net)}
          icon={<BadgeDollarSign size={18} />}
          valueClass="text-red-600"
          sub={`Gider KDV: ${money(kpis?.opex_vat)}`}
        />
        <Kpi
          title="Diğer Gelir (Net)"
          value={money(kpis?.other_income_net)}
          icon={<HandCoins size={18} />}
          sub={`KDV: ${money(kpis?.other_income_vat)}`}
        />
        <Kpi
          title="Stok Değeri"
          value={money(kpis?.inventory_value_total)}
          icon={<Boxes size={18} />}
          sub={`Resmi: ${money(kpis?.inventory_value_official)} | Fiili: ${money(kpis?.inventory_value_actual)}`}
        />
        <Kpi
          title="Açık Alacak / Borç"
          value={`${money(kpis?.open_receivable)} / ${money(kpis?.open_payable)}`}
          icon={<CreditCard size={18} />}
          sub="Cari snapshot alanları varsa hesaplanır"
        />
      </div>

      {/* links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 pt-2">
        <Card
          title="Tahsilat"
          desc="Müşteriden tahsilat / avans"
          href="/satissitok/admin/finance/collect"
          icon={<ReceiptText />}
          color="green"
        />

        <Card
          title="Ödeme"
          desc="Tedarikçiye ödeme / avans"
          href="/satissitok/admin/finance/pay"
          icon={<ReceiptText />}
          color="blue"
        />

        <Card
          title="Kasa/Banka Hareketleri"
          desc="cash_transactions listesi"
          href="/satissitok/admin/finance/cash"
          icon={<Wallet />}
          color="purple"
        />

        <Card
          title="Hesaplar"
          desc="Nakit, Kaspi, Banka..."
          href="/satissitok/admin/finance/accounts"
          icon={<Landmark />}
          color="orange"
        />

        <Card
          title="Giderler"
          desc="Operasyonel gider kayıtları"
          href="/satissitok/admin/finance/expenses"
          icon={<BadgeDollarSign />}
          color="gray"
        />
      </div>

      <div className="text-xs text-gray-500">
        * Net kâr hesabı: <b>Brüt Kâr + Diğer Gelir - Gider</b>. Brüt kâr satış belgelerindeki <code>profitTotal</code> (net) üzerinden gelir.
      </div>
    </div>
  );
}

function Kpi({ title, value, sub, icon, valueClass = "text-gray-900" }) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-gray-700">{icon}</div>
      </div>
      <div className={`text-xl font-semibold mt-1 ${valueClass}`}>{value}</div>
      {sub ? <div className="text-xs text-gray-500 mt-2">{sub}</div> : null}
    </div>
  );
}

function Card({ title, desc, href, icon, color }) {
  const colors = {
    green: "border-green-300 hover:border-green-500 text-green-700",
    blue: "border-blue-300 hover:border-blue-500 text-blue-700",
    purple: "border-purple-300 hover:border-purple-500 text-purple-700",
    orange: "border-orange-300 hover:border-orange-500 text-orange-700",
    gray: "border-gray-300 hover:border-gray-500 text-gray-700",
  };

  return (
    <Link
      href={href}
      className={`flex flex-col gap-2 p-6 border rounded-xl bg-white shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 ${
        colors[color] || "border-gray-300"
      }`}
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-50">
        {icon}
      </div>

      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-gray-600">{desc}</div>
    </Link>
  );
}