"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ErpSectionHeader from "../_components/ErpSectionHeader";
import { exportErpReportDashboardToExcel } from "../_services/erpReportsExportService";
import { getErpReportDashboard } from "../_services/erpReportsService";

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `%${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function defaultFilters() {
  return {
    startDate: "",
    endDate: "",
  };
}

function StatCard({ label, value, hint, tone = "slate" }) {
  const toneMap = {
    slate: "border-slate-200 bg-white text-slate-900",
    green: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    blue: "border-blue-200 bg-blue-50/70 text-blue-900",
    amber: "border-amber-200 bg-amber-50/70 text-amber-900",
    red: "border-rose-200 bg-rose-50/70 text-rose-900",
  };

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${toneMap[tone] || toneMap.slate}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-[-0.03em]">{value}</div>
      {hint ? <div className="mt-2 text-sm text-slate-600">{hint}</div> : null}
    </div>
  );
}

function MiniMetric({ label, value, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-900",
    green: "bg-emerald-50 text-emerald-900",
    blue: "bg-blue-50 text-blue-900",
    amber: "bg-amber-50 text-amber-900",
    red: "bg-rose-50 text-rose-900",
  };

  return (
    <div className={`rounded-[20px] p-4 ${toneMap[tone] || toneMap.slate}`}>
      <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

function SummaryCard({ title, summary, href, accentClass }) {
  return (
    <div className={`rounded-[28px] border bg-white p-6 shadow-sm ${accentClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-[#1d3246]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Onayli belge toplamlarini ve R/F dagilimini tek yerden izlersin.
          </p>
        </div>
        <Link
          href={href}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Listeye git
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Onayli Toplam" value={`${formatMoney(summary.confirmedTotal)} KZT`} tone="slate" />
        <MiniMetric label="R Belge" value={`${formatMoney(summary.rTotal)} KZT`} tone="green" />
        <MiniMetric label="F Belge" value={`${formatMoney(summary.fTotal)} KZT`} tone="blue" />
        <MiniMetric label="Acik Bakiye" value={`${formatMoney(summary.openTotal)} KZT`} tone="amber" />
      </div>
    </div>
  );
}

function ProfitSummaryCard({ summary }) {
  return (
    <div className="rounded-[28px] border border-emerald-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-black tracking-[-0.03em] text-[#1d3246]">Satis Karlilik Ozeti</h2>
        <p className="text-sm leading-6 text-slate-600">
          Onayli satislardan olusan gelir, gerceklesen maliyet ve brut kar gorunumu.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Ciro" value={`${formatMoney(summary.totalRevenue)} KZT`} tone="green" />
        <MiniMetric label="Gerceklesen Maliyet" value={`${formatMoney(summary.totalCost)} KZT`} tone="red" />
        <MiniMetric label="Brut Kar" value={`${formatMoney(summary.totalGrossProfit)} KZT`} tone="blue" />
        <MiniMetric label="Marj" value={formatPercent(summary.marginRate)} tone="amber" />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <span>{summary.documentCount} onayli satis belgesi</span>
        <span>{summary.profitableCount} karli</span>
        <span>{summary.lossCount} zararda</span>
        <span>{summary.zeroProfitCount} basa bas</span>
      </div>
    </div>
  );
}

function PurchaseCostSummaryCard({ summary }) {
  return (
    <div className="rounded-[28px] border border-blue-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-black tracking-[-0.03em] text-[#1d3246]">Satinalma Maliyet Ozeti</h2>
        <p className="text-sm leading-6 text-slate-600">
          Mal bedeli, ek masraf ve landed cost yapisini toplu halde izlersin.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Mal Bedeli" value={`${formatMoney(summary.totalGoods)} KZT`} tone="blue" />
        <MiniMetric label="Ek Masraf" value={`${formatMoney(summary.totalAdditional)} KZT`} tone="amber" />
        <MiniMetric label="Toplam Maliyet" value={`${formatMoney(summary.totalLanded)} KZT`} tone="red" />
        <MiniMetric label="Masraf Yuku" value={formatPercent(summary.burdenRate)} tone="green" />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <span>{summary.documentCount} onayli satinalma belgesi</span>
        <span>{summary.costLoadedCount} belgede ek masraf var</span>
      </div>
    </div>
  );
}

function ProductProfitSummaryCard({ summary }) {
  return (
    <div className="rounded-[28px] border border-amber-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-black tracking-[-0.03em] text-[#1d3246]">Urun Bazli Karlilik</h2>
        <p className="text-sm leading-6 text-slate-600">
          Satis satirlari ile gerceklesen stok maliyetini birlestirerek urun bazli kar gorunumu uretir.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Urun Sayisi" value={summary.productCount} tone="amber" />
        <MiniMetric label="Satilan Miktar" value={formatMoney(summary.totalSoldQty)} tone="blue" />
        <MiniMetric label="Toplam Kar" value={`${formatMoney(summary.totalGrossProfit)} KZT`} tone="green" />
        <MiniMetric label="Marj" value={formatPercent(summary.marginRate)} tone="red" />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <span>{summary.fallbackCount} kez fallback maliyet kullanildi</span>
      </div>
    </div>
  );
}

function TableCard({ title, description, children, action, note }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-[#1d3246]">{title}</h2>
          {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
          {note ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">{note}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function FiltersBar({ form, onChange, onApply, onReset, onExport, applying, exporting, rangeLabel }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-4 md:grid-cols-2 xl:w-[420px]">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Baslangic Tarihi</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) => onChange("startDate", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Bitis Tarihi</span>
            <input
              type="date"
              value={form.endDate}
              onChange={(event) => onChange("endDate", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="text-sm text-slate-600">{rangeLabel}</div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onApply}
              disabled={applying}
              className="rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applying ? "Uygulaniyor..." : "Filtreyi Uygula"}
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={applying}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Tarihi Temizle
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={exporting || applying}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? "Excel Hazirlaniyor..." : "Excel Aktar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformTable({ rows }) {
  if (!rows.length) return <EmptyState message="Platform bazli onayli satis henuz yok." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Platform</th>
            <th className="px-3 py-3 font-semibold">Belge</th>
            <th className="px-3 py-3 font-semibold">R Toplam</th>
            <th className="px-3 py-3 font-semibold">F Toplam</th>
            <th className="px-3 py-3 font-semibold">Genel Toplam</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key || row.label} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 font-semibold text-slate-900">{row.label}</td>
              <td className="px-3 py-3 text-slate-600">{row.count}</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.rTotal)} KZT</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.fTotal)} KZT</td>
              <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(row.total)} KZT</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpenDocumentTable({ rows, settlementLabel, returnTo }) {
  if (!rows.length) return <EmptyState message="Bu listede acik belge bulunmuyor." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Tarih</th>
            <th className="px-3 py-3 font-semibold">Tip</th>
            <th className="px-3 py-3 font-semibold">Belge</th>
            <th className="px-3 py-3 font-semibold">Cari</th>
            <th className="px-3 py-3 font-semibold">Acik Tutar</th>
            <th className="px-3 py-3 font-semibold">Islem</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 text-slate-600">{row.dateLabel}</td>
              <td className="px-3 py-3 font-semibold text-slate-900">{row.docType}</td>
              <td className="px-3 py-3 text-slate-600">
                <div>{row.documentNo}</div>
                <div className="text-xs text-slate-400">{row.invoiceNo}</div>
              </td>
              <td className="px-3 py-3 text-slate-600">{row.cariName}</td>
              <td className="px-3 py-3 font-semibold text-amber-700">{formatMoney(row.outstandingAmount)} KZT</td>
              <td className="px-3 py-3">
                <Link
                  href={`/satissitok/admin/erp/finance/settlements/new?documentId=${row.id}&documentCollection=${row.kind === "sales" ? "erp_sales" : "erp_purchases"}&returnTo=${encodeURIComponent(returnTo)}`}
                  className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
                >
                  {settlementLabel}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockTable({ rows, emptyMessage, qtyTone = "text-slate-900" }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Urun</th>
            <th className="px-3 py-3 font-semibold">SKU</th>
            <th className="px-3 py-3 font-semibold">R</th>
            <th className="px-3 py-3 font-semibold">F</th>
            <th className="px-3 py-3 font-semibold">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 font-semibold text-slate-900">{row.name}</td>
              <td className="px-3 py-3 text-slate-600">{row.sku || "-"}</td>
              <td className="px-3 py-3 text-slate-600">{row.rQty}</td>
              <td className="px-3 py-3 text-slate-600">{row.fQty}</td>
              <td className={`px-3 py-3 font-semibold ${qtyTone}`}>{row.totalQty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinanceTable({ rows }) {
  if (!rows.length) return <EmptyState message="Kasa ve banka hesabi henuz yok." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Hesap</th>
            <th className="px-3 py-3 font-semibold">Tip</th>
            <th className="px-3 py-3 font-semibold">Acilis</th>
            <th className="px-3 py-3 font-semibold">Guncel</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 font-semibold text-slate-900">{row.name}</td>
              <td className="px-3 py-3 uppercase text-slate-600">{row.type}</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.openingBalance)} KZT</td>
              <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(row.currentBalance)} KZT</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovementTable({ rows }) {
  if (!rows.length) return <EmptyState message="Hareket olustukca burada gorunecek." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Tarih</th>
            <th className="px-3 py-3 font-semibold">Yon</th>
            <th className="px-3 py-3 font-semibold">Hesap</th>
            <th className="px-3 py-3 font-semibold">Cari</th>
            <th className="px-3 py-3 font-semibold">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 text-slate-600">{row.dateLabel}</td>
              <td className={`px-3 py-3 font-semibold ${row.direction === "in" ? "text-emerald-700" : "text-rose-700"}`}>
                {row.direction === "in" ? "Giris" : "Cikis"}
              </td>
              <td className="px-3 py-3 text-slate-600">{row.accountName || "-"}</td>
              <td className="px-3 py-3 text-slate-600">{row.cariName || "-"}</td>
              <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(row.amount)} KZT</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfitabilityTable({ rows, emptyMessage }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Belge</th>
            <th className="px-3 py-3 font-semibold">Cari</th>
            <th className="px-3 py-3 font-semibold">Platform</th>
            <th className="px-3 py-3 font-semibold">Ciro</th>
            <th className="px-3 py-3 font-semibold">Maliyet</th>
            <th className="px-3 py-3 font-semibold">Kar</th>
            <th className="px-3 py-3 font-semibold">Marj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 text-slate-600">
                <div className="font-semibold text-slate-900">{row.documentNo}</div>
                <div className="text-xs text-slate-400">{row.invoiceNo}</div>
              </td>
              <td className="px-3 py-3 text-slate-600">{row.cariName}</td>
              <td className="px-3 py-3 text-slate-600">{row.platformLabel}</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.revenue)} KZT</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.cost)} KZT</td>
              <td className={`px-3 py-3 font-semibold ${row.grossProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {formatMoney(row.grossProfit)} KZT
              </td>
              <td className="px-3 py-3 font-semibold text-slate-900">{formatPercent(row.marginRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlatformProfitTable({ rows }) {
  if (!rows.length) return <EmptyState message="Platform karlilik verisi henuz olusmadi." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Platform</th>
            <th className="px-3 py-3 font-semibold">Belge</th>
            <th className="px-3 py-3 font-semibold">Ciro</th>
            <th className="px-3 py-3 font-semibold">Maliyet</th>
            <th className="px-3 py-3 font-semibold">Brut Kar</th>
            <th className="px-3 py-3 font-semibold">Marj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key || row.label} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 font-semibold text-slate-900">{row.label}</td>
              <td className="px-3 py-3 text-slate-600">{row.documentCount}</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.revenue)} KZT</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.cost)} KZT</td>
              <td className={`px-3 py-3 font-semibold ${row.grossProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {formatMoney(row.grossProfit)} KZT
              </td>
              <td className="px-3 py-3 font-semibold text-slate-900">{formatPercent(row.averageMarginRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PurchaseCostTable({ rows, emptyMessage }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Belge</th>
            <th className="px-3 py-3 font-semibold">Cari</th>
            <th className="px-3 py-3 font-semibold">Mal Bedeli</th>
            <th className="px-3 py-3 font-semibold">Ek Masraf</th>
            <th className="px-3 py-3 font-semibold">Toplam Maliyet</th>
            <th className="px-3 py-3 font-semibold">Yuk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 text-slate-600">
                <div className="font-semibold text-slate-900">{row.documentNo}</div>
                <div className="text-xs text-slate-400">{row.invoiceNo}</div>
              </td>
              <td className="px-3 py-3 text-slate-600">{row.cariName}</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.goodsTotal)} KZT</td>
              <td className="px-3 py-3 font-semibold text-amber-700">{formatMoney(row.additionalCostTotal)} KZT</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.landedCostTotal)} KZT</td>
              <td className="px-3 py-3 font-semibold text-slate-900">{formatPercent(row.burdenRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierCostTable({ rows }) {
  if (!rows.length) return <EmptyState message="Tedarikci maliyet dagilimi henuz olusmadi." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Cari</th>
            <th className="px-3 py-3 font-semibold">Belge</th>
            <th className="px-3 py-3 font-semibold">Mal Bedeli</th>
            <th className="px-3 py-3 font-semibold">Ek Masraf</th>
            <th className="px-3 py-3 font-semibold">Toplam Maliyet</th>
            <th className="px-3 py-3 font-semibold">Yuk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cariName} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 font-semibold text-slate-900">{row.cariName}</td>
              <td className="px-3 py-3 text-slate-600">{row.documentCount}</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.goodsTotal)} KZT</td>
              <td className="px-3 py-3 font-semibold text-amber-700">{formatMoney(row.additionalCostTotal)} KZT</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.landedCostTotal)} KZT</td>
              <td className="px-3 py-3 font-semibold text-slate-900">{formatPercent(row.burdenRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductProfitTable({ rows, emptyMessage }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Urun</th>
            <th className="px-3 py-3 font-semibold">SKU</th>
            <th className="px-3 py-3 font-semibold">Miktar</th>
            <th className="px-3 py-3 font-semibold">R / F</th>
            <th className="px-3 py-3 font-semibold">Ciro</th>
            <th className="px-3 py-3 font-semibold">Maliyet</th>
            <th className="px-3 py-3 font-semibold">Kar</th>
            <th className="px-3 py-3 font-semibold">Marj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-3 text-slate-600">
                <div className="font-semibold text-slate-900">{row.name}</div>
                <div className="text-xs text-slate-400">{row.documentCount} belge</div>
              </td>
              <td className="px-3 py-3 text-slate-600">{row.sku || "-"}</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.soldQty)}</td>
              <td className="px-3 py-3 text-slate-600">
                {formatMoney(row.rQtySold)} / {formatMoney(row.fQtySold)}
              </td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.revenue)} KZT</td>
              <td className="px-3 py-3 text-slate-600">{formatMoney(row.cost)} KZT</td>
              <td className={`px-3 py-3 font-semibold ${row.grossProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {formatMoney(row.grossProfit)} KZT
              </td>
              <td className="px-3 py-3 font-semibold text-slate-900">{formatPercent(row.marginRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ErpReportsPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [filterForm, setFilterForm] = useState(defaultFilters());
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters());

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await getErpReportDashboard(appliedFilters);
        if (!active) return;
        setDashboard(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Raporlar yuklenemedi.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [appliedFilters]);

  function setFilterField(field, value) {
    setFilterForm((current) => ({ ...current, [field]: value }));
  }

  function applyFilters() {
    if (filterForm.startDate && filterForm.endDate && filterForm.startDate > filterForm.endDate) {
      setError("Baslangic tarihi bitis tarihinden buyuk olamaz.");
      return;
    }
    setError("");
    setAppliedFilters(filterForm);
  }

  function resetFilters() {
    const cleared = defaultFilters();
    setError("");
    setFilterForm(cleared);
    setAppliedFilters(cleared);
  }

  async function handleExport() {
    try {
      setExporting(true);
      setError("");
      await exportErpReportDashboardToExcel(dashboard);
    } catch (exportError) {
      setError(exportError?.message || "Excel disa aktarimi basarisiz oldu.");
    } finally {
      setExporting(false);
    }
  }

  const rangeLabel = dashboard?.filters?.hasDateFilter
    ? `Aktif aralik: ${dashboard.filters.startDate || "..."} - ${dashboard.filters.endDate || "..."}`
    : "Tum tarihler gosteriliyor";

  return (
    <div className="space-y-6">
      <ErpSectionHeader
        eyebrow="ERP / Raporlar"
        title="Rapor Merkezi"
        description="Satis, satinalma, stok, cari, finans, karlilik ve maliyet verilerini tek ekranda izleyebilecegin gelismis rapor merkezi."
      />

      <FiltersBar
        form={filterForm}
        onChange={setFilterField}
        onApply={applyFilters}
        onReset={resetFilters}
        onExport={handleExport}
        applying={loading}
        exporting={exporting}
        rangeLabel={rangeLabel}
      />

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Rapor verileri yukleniyor...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error && dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Net satis hacmi"
              value={`${formatMoney(dashboard.overview.confirmedSalesTotal)} KZT`}
              hint="Onayli satis belgeleri"
              tone="green"
            />
            <StatCard
              label="Net alim hacmi"
              value={`${formatMoney(dashboard.overview.confirmedPurchaseTotal)} KZT`}
              hint="Onayli satinalma belgeleri"
              tone="blue"
            />
            <StatCard
              label="Tahsil edilecek"
              value={`${formatMoney(dashboard.overview.receivableOpenTotal)} KZT`}
              hint="Acik satis bakiyesi"
              tone="amber"
            />
            <StatCard
              label="Odeme bekleyen"
              value={`${formatMoney(dashboard.overview.payableOpenTotal)} KZT`}
              hint="Acik satinalma bakiyesi"
              tone="red"
            />
            <StatCard
              label="Kasa banka toplam"
              value={`${formatMoney(dashboard.overview.totalCashBalance)} KZT`}
              hint="Tum aktif finans hesaplari"
              tone="slate"
            />
            <StatCard
              label="Negatif stok"
              value={dashboard.overview.negativeStockCount}
              hint={`${dashboard.stockSnapshot.positiveCount} pozitif, ${dashboard.stockSnapshot.zeroCount} sifir stok`}
              tone="red"
            />
            <StatCard
              label="Aktif cari"
              value={dashboard.overview.activeCariCount}
              hint={`${dashboard.cariSnapshot.inactiveCount} pasif cari kaydi var`}
              tone="blue"
            />
            <StatCard
              label="Urun kapsami"
              value={dashboard.overview.totalProductCount}
              hint="Anlik stok listesine dahil urunler"
              tone="slate"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SummaryCard
              title="Satis Ozeti"
              summary={dashboard.salesSummary}
              href="/satissitok/admin/erp/sales"
              accentClass="border-emerald-200"
            />
            <SummaryCard
              title="Satinalma Ozeti"
              summary={dashboard.purchaseSummary}
              href="/satissitok/admin/erp/purchases"
              accentClass="border-blue-200"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ProfitSummaryCard summary={dashboard.salesProfitability.summary} />
            <PurchaseCostSummaryCard summary={dashboard.purchaseCosts.summary} />
            <ProductProfitSummaryCard summary={dashboard.productProfitability.summary} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TableCard
              title="Platform Karlilik"
              description="Satis platformlarini sadece ciroya degil, kar uretimine gore de karsilastirirsin."
              action={
                <Link
                  href="/satissitok/admin/erp/sales"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Satislara git
                </Link>
              }
            >
              <PlatformProfitTable rows={dashboard.salesProfitability.byPlatform} />
            </TableCard>

            <TableCard
              title="Tedarikci Maliyet Yukleri"
              description="Hangi tedarikcide ek masraf yukunun daha agir oldugunu hizlica gorursun."
              action={
                <Link
                  href="/satissitok/admin/erp/purchases"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Satinalmalara git
                </Link>
              }
            >
              <SupplierCostTable rows={dashboard.purchaseCosts.bySupplier} />
            </TableCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TableCard title="En Karli Satis Belgeleri" description="En yuksek brut kar getiren belgeleri listeler.">
              <ProfitabilityTable
                rows={dashboard.salesProfitability.topProfitable}
                emptyMessage="Karlilik listesi icin yeterli onayli satis verisi yok."
              />
            </TableCard>

            <TableCard
              title="En Zayif Satis Belgeleri"
              description="Zarar eden veya marji cok dusuk belgeleri erken fark etmeni saglar."
            >
              <ProfitabilityTable
                rows={dashboard.salesProfitability.topLossMaking}
                emptyMessage="Zarar veya dusuk marjli satis bulunmuyor."
              />
            </TableCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TableCard
              title="En Karli Urunler"
              description="Filtrelenen tarih araliginda toplam brut kari en yuksek urunler."
            >
              <ProductProfitTable
                rows={dashboard.productProfitability.topProfitable}
                emptyMessage="Urun karliligi icin yeterli satis verisi yok."
              />
            </TableCard>

            <TableCard
              title="En Zayif Urunler"
              description="Marji dusuk veya zararda kalan urunleri erken fark etmeni saglar."
            >
              <ProductProfitTable
                rows={dashboard.productProfitability.topLossMaking}
                emptyMessage="Zararda urun gorunmuyor."
              />
            </TableCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TableCard
              title="Ek Masrafi En Yuksek Satinalmalar"
              description="Lojistik ve diger ek masraflarin en yogun bindigi alimlari gosterir."
            >
              <PurchaseCostTable
                rows={dashboard.purchaseCosts.topAdditionalCostDocs}
                emptyMessage="Ek masrafli satinalma kaydi henuz yok."
              />
            </TableCard>

            <TableCard
              title="Masraf Yuku En Yuksek Belgeler"
              description="Mal bedeline gore oransal olarak en agir maliyet binen satinalmalar."
            >
              <PurchaseCostTable
                rows={dashboard.purchaseCosts.highestBurdenDocs}
                emptyMessage="Masraf yuku raporu icin yeterli satinalma verisi yok."
              />
            </TableCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TableCard
              title="Platform Bazli Satis"
              description="Hangi satis kanalinin ne kadar hacim urettigini izlersin."
              action={
                <Link
                  href="/satissitok/admin/erp/settings"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Platform ayarlari
                </Link>
              }
            >
              <PlatformTable rows={dashboard.platformSales} />
            </TableCard>

            <TableCard
              title="Finans Hesaplari"
              description="Kasa ve banka hesaplarinin acilis ve guncel bakiye durumu."
              action={
                <Link
                  href="/satissitok/admin/erp/finance"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Finansa git
                </Link>
              }
            >
              <FinanceTable rows={dashboard.cashAccounts} />
            </TableCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TableCard
              title="Acik Satis Belgeleri"
              description="Tahsilati tamamlanmamis onayli satis belgeleri."
              action={
                <Link
                  href="/satissitok/admin/erp/finance/settlements/new"
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Tahsilat gir
                </Link>
              }
            >
              <OpenDocumentTable
                rows={dashboard.openSales}
                settlementLabel="Tahsilat ac"
                returnTo="/satissitok/admin/erp/reports"
              />
            </TableCard>

            <TableCard
              title="Acik Satinalma Belgeleri"
              description="Odemesi tamamlanmamis onayli satinalma belgeleri."
              action={
                <Link
                  href="/satissitok/admin/erp/finance/settlements/new"
                  className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Odeme gir
                </Link>
              }
            >
              <OpenDocumentTable
                rows={dashboard.openPurchases}
                settlementLabel="Odeme ac"
                returnTo="/satissitok/admin/erp/reports"
              />
            </TableCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TableCard
              title="Negatif Stok Uyarisi"
              description="Eksiye dusen urunler once burada gorunur; maliyet ve satis akisinda yakindan izlenmeli."
              note="Stok kartlari anlik bakiyeyi gosterir; tarih filtresi bu bloku daraltmaz."
              action={
                <Link
                  href="/satissitok/admin/erp/stock"
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Stok kartlari
                </Link>
              }
            >
              <StockTable
                rows={dashboard.negativeStocks}
                emptyMessage="Negatif stok gorunmuyor, bu iyi bir isaret."
                qtyTone="text-rose-700"
              />
            </TableCard>

            <TableCard
              title="En Yuksek Stoklar"
              description="Pozitif stokta en ustte duran urunleri hizlica gorursun."
              note="Bu tablo da anlik stok snapshot'ini gosterir."
              action={
                <Link
                  href="/satissitok/admin/erp/stock"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Tum stoklar
                </Link>
              }
            >
              <StockTable
                rows={dashboard.topPositiveStocks}
                emptyMessage="Pozitif stok kaydi henuz yok."
                qtyTone="text-emerald-700"
              />
            </TableCard>
          </div>

          <TableCard
            title="Son Finans Hareketleri"
            description="Yeni tahsilat, odeme ve manuel kasa hareketlerini buradan takip edersin."
            action={
              <Link
                href="/satissitok/admin/erp/finance"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Tum hareketler
              </Link>
            }
          >
            <MovementTable rows={dashboard.recentCashMovements} />
          </TableCard>
        </>
      ) : null}
    </div>
  );
}
