"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildCustomerProductHistory } from "../_services/erpCustomerProductHistory";

const money = (value) => `${Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KZT`;
const qty = (value) => Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 3 });
const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";

export default function ErpCustomerProducts({ documents }) {
  const [filters, setFilters] = useState({ query: "", from: "", to: "", docType: "", vatMode: "included" });
  const rows = useMemo(() => buildCustomerProductHistory(documents, filters), [documents, filters]);
  const change = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Aldığı Ürünler</h3>
        <p className="mt-1 text-sm text-slate-500">Onaylanmış satışlar gösterilir. Miktar, ağırlıklı ortalama ve son fiyat seçilen döneme aittir. Ürün geçmişini açarak tek tek satışları inceleyebilirsin.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-semibold text-slate-600">Ürün / SKU<input className={inputClass} value={filters.query} onChange={change("query")} placeholder="Ürün ara" /></label>
        <label className="text-xs font-semibold text-slate-600">Başlangıç<input type="date" className={inputClass} value={filters.from} onChange={change("from")} /></label>
        <label className="text-xs font-semibold text-slate-600">Bitiş<input type="date" className={inputClass} value={filters.to} onChange={change("to")} /></label>
        <label className="text-xs font-semibold text-slate-600">Belge tipi<select className={inputClass} value={filters.docType} onChange={change("docType")}><option value="">R ve F (ayrı satırlar)</option><option value="R">Resmî (R)</option><option value="F">Fiilî (F)</option></select></label>
        <label className="text-xs font-semibold text-slate-600">Resmî satış fiyatları<select className={inputClass} value={filters.vatMode} onChange={change("vatMode")}><option value="included">KDV dahil</option><option value="excluded">KDV hariç</option></select></label>
      </div>
      {filters.from && filters.to && filters.from > filters.to ? <p role="alert" className="text-sm text-rose-700">Başlangıç tarihi bitiş tarihinden sonra olamaz.</p> : null}
      <p className="text-xs text-slate-500">F satışları ve KDV bilgisi olmayan eski R kayıtları kendi kayıtlı fiyatlarıyla ayrı hesaplanır. Farklı birimler birleştirilmez.</p>
      {!rows.length ? <p className="py-6 text-sm text-slate-500">Bu filtrelere uygun onaylanmış ürün satışı yok.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>{["Ürün", "Fiyat türü", "Toplam miktar", "Ort. birim satış fiyatı", "Son birim satış fiyatı", "Son satış tarihi"].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 align-top">
              <td className="px-3 py-3">
                <div className="font-semibold text-slate-900">{row.productName}</div><div className="text-xs text-slate-500">{row.productSku}</div>
                <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-blue-700">Satış geçmişi ({row.history.length})</summary>
                  <ul className="mt-2 space-y-2">{row.history.map((sale) => <li key={sale.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                    <Link className="font-semibold text-blue-700 underline" href={`/satissitok/admin/erp/sales/${sale.documentId}`}>{sale.documentNo}</Link>
                    <div>{sale.date} · {qty(sale.quantity)} {row.unit} · {money(sale.price)} / {row.unit}</div>
                  </li>)}</ul>
                </details>
              </td>
              <td className="px-3 py-3 text-xs text-slate-500">{row.priceLabel}</td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">{qty(row.quantity)} {row.unit}</td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">{money(row.averagePrice)}</td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums">{money(row.lastPrice)}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.lastDate}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
