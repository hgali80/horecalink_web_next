"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import ErpCashAccountEditor from "./ErpCashAccountEditor";
import { listErpCashAccounts } from "../_services/erpFinanceService";

export default function ErpCashAccountsSettings() {
  const [accounts, setAccounts] = useState([]);
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setAccounts(await listErpCashAccounts()); }
    catch (err) { setError(err?.message || "Hesaplar yuklenemedi."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <section id="cash-accounts" className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Kasa / Banka Hesapları</h2>
          <p className="mt-2 text-sm text-slate-500">ERP genelinde tahsilat ve ödemelerde kullanılacak hesapları yönetin. Hesaplar kendi kaydet düğmesiyle kaydedilir.</p>
        </div>
        <button type="button" disabled={editor !== null} onClick={() => { setEditor(""); setNotice(""); }} className="rounded-2xl bg-[#1d3246] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Yeni Kasa / Banka Hesabı</button>
      </div>
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      {error && <div role="alert" className="text-sm text-rose-700">{error} <button type="button" onClick={refresh} className="underline">Tekrar dene</button></div>}
      {editor !== null && <Suspense fallback={<p>Hesap formu hazırlanıyor...</p>}>
        <ErpCashAccountEditor key={editor || "new"} accountId={editor} onCancel={() => setEditor(null)} onSaved={async () => {
          setEditor(null); setNotice("Hesap kaydedildi. Aktif KZT hesapları ERP işlemlerinde seçilebilir."); await refresh();
        }} />
      </Suspense>}
      {loading ? <p className="text-sm text-slate-500">Hesaplar yükleniyor...</p> : !accounts.length && !error ? <p className="text-sm text-slate-500">Henüz hesap yok. İlk kasa veya banka hesabınızı oluşturun.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-slate-500">{["Hesap", "Tür", "Bakiye", "Durum", "İşlem"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
            <tbody>{accounts.map(account => <tr key={account.id} className="border-b border-slate-100">
              <td className="p-3 font-semibold">{account.name}<span className="block text-xs font-normal text-slate-500">{account.code}</span></td>
              <td className="p-3">{account.type === "bank" ? "Banka" : "Kasa"}</td>
              <td className="whitespace-nowrap p-3">{account.currentBalance.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.currency}</td>
              <td className="p-3">{account.active ? "Aktif" : "Pasif"}{account.currency.toUpperCase() !== "KZT" && " · Yeni işlemlere kapalı"}</td>
              <td className="p-3"><button type="button" disabled={editor !== null} onClick={() => { setEditor(account.id); setNotice(""); }} className="rounded-xl border px-3 py-2 font-semibold disabled:opacity-50">Düzenle</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
