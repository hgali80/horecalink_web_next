"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErpSectionHeader from "../_components/ErpSectionHeader";
import ErpCashMovementCancellation from "../_components/ErpCashMovementCancellation";
import {
  listErpCashAccounts,
  listErpCashMovements,
} from "../_services/erpFinanceService";

function fmtMoney(value, currency = "KZT") {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export default function ErpFinancePage() {
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "", account: "", direction: "", start: "", end: "", status: "" });
  const [page, setPage] = useState(1);
  const [maxRows, setMaxRows] = useState(250);
  const [refresh, setRefresh] = useState(0);
  const [oldestFirst, setOldestFirst] = useState(false);
  const invalidDates = filters.start && filters.end && filters.start > filters.end;
  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  const filtered = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("tr-TR");
    const start = filters.start ? new Date(`${filters.start}T00:00:00`).getTime() : -Infinity;
    const end = filters.end ? new Date(`${filters.end}T23:59:59.999`).getTime() : Infinity;
    return movements.filter((row) =>
      (!filters.account || row.accountId === filters.account) &&
      (!filters.direction || row.direction === filters.direction) &&
      (!filters.status || (filters.status === "cancelled" ? isCancelled(row) : !isCancelled(row))) &&
      row.sortTime >= start && row.sortTime <= end &&
      (!search || [row.accountName, row.cariName, row.documentNo, row.originalDocumentNo, row.receiptNo, row.notes, row.cancellationReason].join(" ").toLocaleLowerCase("tr-TR").includes(search))
    ).sort((a, b) => oldestFirst ? a.sortTime - b.sortTime : b.sortTime - a.sortTime);
  }, [movements, filters, oldestFirst]);
  const flow = useMemo(() => filtered.filter((row) => !isCancelled(row) && row.currency.toUpperCase() === "KZT").reduce((sum, row) => {
    if (row.direction === "in") sum.in += row.amount;
    if (row.direction === "out") sum.out += row.amount;
    return sum;
  }, { in: 0, out: 0 }), [filtered]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filtered.slice((currentPage - 1) * 20, currentPage * 20);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const [nextAccounts, nextMovements] = await Promise.all([
          listErpCashAccounts(),
          listErpCashMovements(maxRows),
        ]);
        if (!alive) return;
        setAccounts(nextAccounts);
        setMovements(nextMovements);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Finans verileri yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [maxRows, refresh]);

  const metrics = useMemo(() => {
    return {
      accountCount: accounts.length,
      activeCount: accounts.filter((item) => item.active).length,
      totalBalance: accounts.filter(item => item.currency.toUpperCase() === "KZT").reduce((sum, item) => sum + Number(item.currentBalance || 0), 0),
    };
  }, [accounts]);

  return (
    <div className="space-y-6">
      <ErpSectionHeader eyebrow="ERP / Finans" title="Finans Merkezi" description="Tahsilat ve ödemelerini kaydet, açık belgelerini kapat ve hesap hareketlerini takip et." />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link href="/satissitok/admin/erp/finance/movements/new" className="rounded-xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white hover:bg-[#243f58]">Yeni Tahsilat / Ödeme</Link>
        <Link href="/satissitok/admin/erp/finance/settlements/new" className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-800 hover:bg-blue-100">Açık Belge Kapat</Link>
        <Link href="/satissitok/admin/erp/finance/accounts/new" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Yeni Hesap</Link>
        <button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)} className="ml-auto rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Yenile</button>
      </div>

      {loading ? (
        <PanelText text="Finans modulu hazirlaniyor..." />
      ) : error ? (
        <PanelText tone="error" text={error} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Güncel toplam bakiye" value={fmtMoney(metrics.totalBalance)} hint="Tüm KZT hesapları · Filtrelerden bağımsız" />
            <MetricCard label="Hesap durumu" value={`${metrics.activeCount} aktif / ${metrics.accountCount} hesap`} hint="Kasa ve banka hesapları" />
            <MetricCard label="Negatif bakiyeli hesap" value={String(accounts.filter((account) => account.currentBalance < 0).length)} hint="Hesap kartlarından hareketleri inceleyebilirsin" />
          </div>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Hesaplar</h3>
              <div className="text-sm text-slate-500">Kasa ve banka hesapları</div>
            </div>

            {!accounts.length ? (
              <PanelText text="Henuz finans hesabi yok. Ilk olarak kasa veya banka hesabi olustur." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {accounts.map((account) => (
                  <div key={account.id} className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
                          {account.type === "bank" ? "Banka Hesabı" : "Kasa Hesabı"}
                        </div>
                        <div className="text-lg font-bold tracking-[-0.03em] text-[#1d3246]">
                          {account.name}
                        </div>
                        <div className="text-sm text-slate-500">{account.code || (account.active ? "Aktif hesap" : "Pasif hesap")}</div>
                      </div>

                      <Link
                        href={`/satissitok/admin/erp/finance/accounts/${account.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        Düzenle
                      </Link>
                    </div>

                    <div className="mt-5">
                      <div className="text-xs font-medium text-slate-500">Güncel bakiye</div>
                      <div className={`mt-1 overflow-x-auto whitespace-nowrap text-2xl font-bold tabular-nums ${account.currentBalance < 0 ? "text-rose-700" : "text-[#1d3246]"}`}>{fmtMoney(account.currentBalance, account.currency)}</div>
                      {account.currentBalance < 0 ? <span className="mt-2 inline-block rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Negatif bakiye</span> : null}
                    </div>
                    <div className="mt-4 text-xs leading-6 text-slate-500">Açılış: {fmtMoney(account.openingBalance, account.currency)} · {account.active ? "Aktif" : "Pasif"}<br />Son güncelleme: {account.updatedLabel}</div>
                    <a href="#finance-movements" onClick={() => { setFilters({ search: "", account: account.id, direction: "", start: "", end: "" }); setPage(1); }} className="mt-3 inline-flex rounded-lg py-2 text-sm font-semibold text-blue-700 hover:underline">Hareketleri gör →</a>

                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 id="finance-movements" className="scroll-mt-6 text-lg font-bold text-slate-900">Finans Hareketleri</h3>
              <div className="text-sm text-slate-500">{movements.length} hareket yüklendi</div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FilterField label="Ara"><input type="search" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Cari, belge, makbuz, açıklama…" className={fieldClass} /></FilterField>
                <FilterField label="Hesap"><select value={filters.account} onChange={(event) => updateFilter("account", event.target.value)} className={fieldClass}><option value="">Tüm hesaplar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></FilterField>
                <FilterField label="Yön"><select value={filters.direction} onChange={(event) => updateFilter("direction", event.target.value)} className={fieldClass}><option value="">Giriş ve çıkış</option><option value="in">Giriş</option><option value="out">Çıkış</option></select></FilterField>
                <FilterField label="Durum"><select value={filters.status || ""} onChange={(event) => updateFilter("status", event.target.value)} className={fieldClass}><option value="">Tüm durumlar</option><option value="active">Aktif hareketler</option><option value="cancelled">İptal edilenler</option></select></FilterField>
                <FilterField label="Başlangıç tarihi"><input type="date" value={filters.start} onChange={(event) => updateFilter("start", event.target.value)} className={fieldClass} /></FilterField>
                <FilterField label="Bitiş tarihi"><input type="date" value={filters.end} onChange={(event) => updateFilter("end", event.target.value)} className={fieldClass} /></FilterField>
                <button type="button" onClick={() => { setFilters({ search: "", account: "", direction: "", start: "", end: "" }); setPage(1); }} className="self-end rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">Filtreleri temizle</button>
              </div>
              {invalidDates ? <p role="alert" className="text-sm text-rose-700">Başlangıç tarihi bitiş tarihinden sonra olamaz.</p> : null}
              <p className="text-xs text-slate-500">Tahsilat ve ödeme iptallerini hareketin yanındaki işlemden yönetebilirsin. İptal edilen kayıtlar geçmişte görünür, aşağıdaki toplamlara dahil edilmez.</p>
              <p className="text-xs leading-5 text-slate-500">Arama ve toplamlar yüklenen hareketleri kapsar. {movements.length === maxRows ? "Eski kayıtları incelemek için aşağıdan daha fazla hareket yükle." : "Mevcut tüm hareketler yüklendi."} Özet toplamları yalnızca KZT hareketlerini kapsar; hesap bakiyeleri bu filtrelerle değişmez.</p>
              {!invalidDates ? <div className="grid gap-3 sm:grid-cols-3">
                <InfoTile label="Filtrelenen giriş" value={fmtMoney(flow.in)} />
                <InfoTile label="Filtrelenen çıkış" value={fmtMoney(flow.out)} />
                <InfoTile label="Net hareket" value={fmtMoney(flow.in - flow.out)} />
              </div> : null}
            </div>

            {!filtered.length ? (
              <PanelText text="Bu filtrelere uygun hareket bulunamadı. Filtreleri temizleyebilir veya eski kayıtları yükleyebilirsin." />
            ) : (
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <Th>Yön</Th>
                        <Th>Tür</Th>
                        <Th>Hesap</Th>
                        <Th>Cari</Th>
                        <Th>Belge</Th>
                        <Th>Makbuz</Th>
                        <Th><button type="button" onClick={() => { setOldestFirst((value) => !value); setPage(1); }} aria-label={oldestFirst ? "En yeni tarih önce sırala" : "En eski tarih önce sırala"}>Tarih {oldestFirst ? "↑" : "↓"}</button></Th>
                        <Th align="right">Tutar</Th>
                        <Th>Durum / İşlem</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <Td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.direction === "out" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{row.direction === "out" ? "Çıkış" : "Giriş"}</span></Td>
                          <Td>{movementLabel(row)}</Td>
                          <Td>{row.accountName || "-"}</Td>
                          <Td>{row.cariName || "-"}</Td>
                          <Td>{row.documentNo || row.originalDocumentNo || "-"}{row.advanceFromCancellation ? <div className="mt-1 text-xs text-amber-700">İptalden kalan avans</div> : null}</Td>
                          <Td>{row.receiptNo || "-"}</Td>
                          <Td>{row.dateLabel}</Td>
                          <Td align="right"><span className={`whitespace-nowrap font-semibold tabular-nums ${row.direction === "out" ? "text-rose-700" : "text-emerald-700"}`}>{row.direction === "out" ? "−" : "+"}{fmtMoney(row.amount, row.currency)}</span></Td>
                          <Td><ErpCashMovementCancellation record={row} onCancelled={() => setRefresh(value => value + 1)} /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span role="status">{filtered.length} sonuç · Sayfa {currentPage} / {pageCount}</span>
              <div className="flex gap-2">
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">Önceki</button>
                <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">Sonraki</button>
              </div>
              {movements.length === maxRows ? <button type="button" onClick={() => setMaxRows((value) => value + 250)} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-800">Daha eski hareketleri yükle</button> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 overflow-x-auto whitespace-nowrap text-2xl font-bold tracking-[-0.03em] text-[#1d3246]">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 overflow-x-auto whitespace-nowrap text-lg font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function PanelText({ text, tone = "normal" }) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-white text-slate-600";

  return <div className={`rounded-[28px] border p-6 text-sm leading-7 shadow-sm ${className}`}>{text}</div>;
}

function Th({ children, align = "left" }) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  return (
    <th className={`px-4 py-4 ${alignClass} text-xs font-extrabold uppercase tracking-[0.14em]`}>
      {children}
    </th>
  );
}

function Td({ children, align = "left" }) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  return <td className={`px-4 py-4 ${alignClass} text-slate-700`}>{children}</td>;
}

const fieldClass = "w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300";
function FilterField({ label, children }) {
  return <label className="min-w-0 space-y-2"><span className="block text-xs font-semibold text-slate-600">{label}</span>{children}</label>;
}
function movementLabel(row) {
  if (row.kind === "document_settlement") return row.direction === "out" ? "Belge ödemesi" : "Belge tahsilatı";
  if (row.kind === "manual") return row.direction === "out" ? "Manuel çıkış" : "Manuel giriş";
  return { transfer: "Hesap transferi", expense: "Gider", payment: "Ödeme", collection: "Tahsilat" }[row.kind] || "Diğer hareket";
}

function isCancelled(row) {
  return ["cancelled", "canceled", "void"].includes(row.status);
}
