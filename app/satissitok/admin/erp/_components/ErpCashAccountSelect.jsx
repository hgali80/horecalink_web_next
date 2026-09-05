"use client";

import { useState } from "react";
import { listErpCashAccountOptions } from "../_services/erpFinanceService";

export default function ErpCashAccountSelect({ value, onChange, options, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    setLoading(true); setError("");
    try {
      const rows = await listErpCashAccountOptions();
      onRefresh(rows);
      // Keep an existing selection, including historical inactive accounts, visible.
      if (!value) onChange(rows[0]?.value || "");
    } catch (err) { setError(err?.message || "Hesaplar yenilenemedi."); }
    finally { setLoading(false); }
  }
  return <div className="space-y-2">
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Kasa / Banka Hesabı</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        <option value="">Hesap seçin</option>
        {value && !options.some(item => item.value === value) && <option value={value} disabled>Önceki hesap (kullanılamıyor) — aktif hesap seçin</option>}
        {options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
    <div className="flex flex-wrap gap-4 text-xs font-semibold">
      <a href="/satissitok/admin/erp/settings#cash-accounts" target="_blank" rel="noopener noreferrer" className="text-slate-600 underline">Hesap ekle / yönet ↗</a>
      <button type="button" disabled={loading} onClick={refresh} className="text-slate-600 underline">{loading ? "Yenileniyor..." : "Hesapları yenile"}</button>
    </div>
    {!options.length && <p className="text-xs text-amber-700">Aktif KZT hesabı yok. Hesap oluşturduktan sonra listeyi yenileyin.</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
  </div>;
}
