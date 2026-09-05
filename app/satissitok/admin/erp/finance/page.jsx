"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErpSectionHeader from "../_components/ErpSectionHeader";
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

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const [nextAccounts, nextMovements] = await Promise.all([
          listErpCashAccounts(),
          listErpCashMovements(),
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
  }, []);

  const metrics = useMemo(() => {
    return {
      accountCount: accounts.length,
      activeCount: accounts.filter((item) => item.active).length,
      totalBalance: accounts.filter(item => item.currency.toUpperCase() === "KZT").reduce((sum, item) => sum + Number(item.currentBalance || 0), 0),
    };
  }, [accounts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <ErpSectionHeader
          eyebrow="ERP / Finans"
          title="Finans Merkezi"
          description="Kasa-banka hesaplari, tahsilat, odeme, belge kapama ve gider hareketleri bu modulde bir araya gelecek."
        />

        <Link
          href="/satissitok/admin/erp/finance/accounts/new"
          className="inline-flex items-center justify-center rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58]"
        >
          Yeni Hesap
        </Link>
        <Link
          href="/satissitok/admin/erp/finance/movements/new"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Yeni Tahsilat / Odeme
        </Link>
        <Link
          href="/satissitok/admin/erp/finance/settlements/new"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Acik Belge Kapat
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Toplam Hesap" value={String(metrics.accountCount)} />
        <MetricCard label="Aktif Hesap" value={String(metrics.activeCount)} />
        <MetricCard label="Toplam Bakiye (KZT Hesapları)" value={fmtMoney(metrics.totalBalance)} />
      </div>

      {loading ? (
        <PanelText text="Finans modulu hazirlaniyor..." />
      ) : error ? (
        <PanelText tone="error" text={error} />
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Hesaplar</h3>
              <div className="text-sm text-slate-500">Kasa ve banka hesaplari</div>
            </div>

            {!accounts.length ? (
              <PanelText text="Henuz finans hesabi yok. Ilk olarak kasa veya banka hesabi olustur." />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
                          {account.type === "bank" ? "Banka Hesabi" : "Kasa Hesabi"}
                        </div>
                        <div className="text-2xl font-black tracking-[-0.03em] text-[#1d3246]">
                          {account.name}
                        </div>
                        <div className="text-sm text-slate-500">{account.code || "Kod yok"}</div>
                      </div>

                      <Link
                        href={`/satissitok/admin/erp/finance/accounts/${account.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        Duzenle
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <InfoTile label="Acilis" value={fmtMoney(account.openingBalance, account.currency)} />
                      <InfoTile label="Guncel" value={fmtMoney(account.currentBalance, account.currency)} />
                    </div>

                    <div className="mt-4 text-xs text-slate-500">
                      {account.active ? "aktif" : "pasif"} · son guncelleme {account.updatedLabel}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Son Finans Hareketleri</h3>
              <div className="text-sm text-slate-500">Belgeden veya manuel islemlerden gelecek</div>
            </div>

            {!movements.length ? (
              <PanelText text="Henuz finans hareketi yok. Belge onayinda aninda tahsilat / odeme secersen buraya dusmeye baslayacak." />
            ) : (
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <Th>Yon</Th>
                        <Th>Tur</Th>
                        <Th>Hesap</Th>
                        <Th>Cari</Th>
                        <Th>Belge</Th>
                        <Th>Makbuz</Th>
                        <Th>Tarih</Th>
                        <Th align="right">Tutar</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <Td>{row.direction === "out" ? "Cikis" : "Giris"}</Td>
                          <Td>{row.kind || "-"}</Td>
                          <Td>{row.accountName || "-"}</Td>
                          <Td>{row.cariName || "-"}</Td>
                          <Td>{row.documentNo || "-"}</Td>
                          <Td>{row.receiptNo || "-"}</Td>
                          <Td>{row.dateLabel}</Td>
                          <Td align="right">{fmtMoney(row.amount, row.currency)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#1d3246]">{value}</div>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-bold text-slate-900">{value}</div>
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
