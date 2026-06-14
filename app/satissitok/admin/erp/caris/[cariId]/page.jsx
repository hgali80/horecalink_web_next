"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getErpCariDashboard } from "../../_services/erpCarisService";

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KZT`;
}

export default function ErpCariDetailPage({ params }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const next = await getErpCariDashboard(params.cariId);
        if (!alive) return;
        setData(next);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Cari detayi yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [params.cariId]);

  if (loading) {
    return <PanelText text="Cari detayi hazirlaniyor..." />;
  }

  if (error || !data) {
    return <PanelText tone="error" text={error || "Cari detayi bulunamadi."} />;
  }

  const { cari, openDocuments, cashMovements, documents, summary } = data;
  const typeLabel = cari.isCustomer && cari.isSupplier
    ? "Musteri + Tedarikci"
    : cari.isCustomer
      ? "Musteri"
      : cari.isSupplier
        ? "Tedarikci"
        : "Genel";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
            ERP / Cariler / Detay
          </div>
          <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">{cari.name}</h2>
          <p className="text-sm text-slate-500">{`${cari.code || "-"} · ${typeLabel} · ${cari.active ? "aktif" : "pasif"}`}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/satissitok/admin/erp/caris"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Listeye Don
          </Link>
          <Link
            href={`/satissitok/admin/erp/finance/movements/new?cariId=${params.cariId}&cariName=${encodeURIComponent(cari.name)}&returnTo=/satissitok/admin/erp/caris/${params.cariId}`}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Tahsilat / Odeme Gir
          </Link>
          <Link
            href={`/satissitok/admin/erp/caris/${params.cariId}/edit?returnTo=/satissitok/admin/erp/caris/${params.cariId}`}
            className="inline-flex items-center justify-center rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58]"
          >
            Cariyi Duzenle
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Acik Belge" value={String(summary.openDocumentCount)} />
        <MetricCard label="Toplam Satis" value={fmtMoney(summary.totalSales)} />
        <MetricCard label="Toplam Satinalma" value={fmtMoney(summary.totalPurchases)} />
        <MetricCard label="Finans Hareketi" value={String(summary.movementCount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Resmi Rekvizit</div>
            <div className="text-sm text-slate-600">Evraklarda ve tekliflerde kullanilacak temel cari bilgileri.</div>
          </div>
          <InfoRow label="Cari Kodu" value={cari.code || "-"} />
          <InfoRow label="Resmi Unvan" value={cari.name || "-"} />
          <InfoRow label="Kisa Ad / Marka" value={cari.shortName || "-"} />
          <InfoRow label="Rol" value={typeLabel} />
          <InfoRow label="BIN / Vergi No" value={cari.bin || cari.taxNo || "-"} />
          <InfoRow label="KBE" value={cari.kbe || "-"} />
          <InfoRow label="Yetkili Kisi" value={cari.directorName || "-"} />
          <InfoRow label="Telefon" value={cari.phone || "-"} />
          <InfoRow label="E-posta" value={cari.email || "-"} />
          <InfoRow label="Vergi Dairesi / Aciklama" value={cari.taxOffice || "-"} />
          <InfoRow label="Para Birimi" value={cari.currency || "KZT"} />
          <InfoRow label="Acilis Alacagi" value={fmtMoney(cari.openingReceivable)} />
          <InfoRow label="Acilis Borcu" value={fmtMoney(cari.openingPayable)} />

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Resmi Adres</div>
            <div>{cari.legalAddress || cari.address || "-"}</div>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Operasyonel Adres</div>
            <div>{cari.address || "-"}</div>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Notlar</div>
            <div>{cari.notes || "-"}</div>
          </div>
        </section>

        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryBox title="Cari Bakiye Alacagi" value={fmtMoney(cari.openingReceivable)} />
            <SummaryBox title="Cari Bakiye Borcu" value={fmtMoney(cari.openingPayable)} />
          </div>

          <div className="space-y-4">
            <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Banka Rekvizitleri</div>
            {cari.bankAccounts?.length ? (
              cari.bankAccounts.map((account, index) => (
                <div key={`${account.iban || account.bankName || "bank"}_${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-bold text-slate-900">Banka Hesabi {index + 1}</div>
                  <div className="space-y-3">
                    <InfoRow label="Banka Adi" value={account.bankName || "-"} />
                    <InfoRow label="BIC / SWIFT" value={account.bik || "-"} />
                    <InfoRow label="IBAN / Hesap No" value={account.iban || "-"} />
                    <InfoRow label="Not" value={account.notes || "-"} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Henuz banka rekviziti girilmemis.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Bu ekran cari karti, acik belge listesi ve finans hareketlerini tek yerde toplar. Bir sonraki
            finans/cari fazinda manuel cari hareketi ve mahsup ekranlari da buraya baglanacak.
          </div>
        </section>
      </div>

      <SectionTable
        title="Acik Belgeler"
        emptyText="Bu cariye ait acik veya kismi kapali belge yok."
        rows={openDocuments}
        columns={["Tur", "Tip", "Belge No", "Fatura No", "Tarih", "Durum", "Toplam"]}
        renderRow={(row) => [
          row.documentKind === "sales" ? "satis" : "satinalma",
          row.docType,
          row.documentNo || "-",
          row.invoiceNo || "-",
          row.dateLabel,
          row.paymentStatus || "-",
          fmtMoney(row.totalAmount),
        ]}
      />

      <SectionTable
        title="Cari Belge Gecmisi"
        emptyText="Bu cariye ait belge gecmisi yok."
        rows={documents}
        columns={["Tur", "Tip", "Belge No", "Fatura No", "Tarih", "Durum", "Toplam"]}
        renderRow={(row) => [
          row.documentKind === "sales" ? "satis" : "satinalma",
          row.docType,
          row.documentNo || "-",
          row.invoiceNo || "-",
          row.dateLabel,
          row.status || "-",
          fmtMoney(row.totalAmount),
        ]}
      />

      <SectionTable
        title="Cari Finans Hareketleri"
        emptyText="Bu cariye ait finans hareketi yok."
        rows={cashMovements}
        columns={["Yon", "Tur", "Hesap", "Makbuz", "Belge", "Tarih", "Tutar"]}
        renderRow={(row) => [
          row.direction === "borc" ? "borc" : "alacak",
          row.kind || "-",
          row.accountName || "-",
          row.receiptNo || "-",
          row.documentNo || "-",
          row.dateLabel,
          fmtMoney(row.amount),
        ]}
      />
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

function SummaryBox({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
      <div className="text-slate-500">{label}</div>
      <div className="text-right font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SectionTable({ title, emptyText, rows, columns, renderRow }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <div className="text-sm text-slate-500">{rows.length} kayit</div>
      </div>

      {!rows.length ? (
        <PanelText text={emptyText} />
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-4 py-4 text-left text-xs font-extrabold uppercase tracking-[0.14em]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    {renderRow(row).map((cell, index) => (
                      <td key={`${row.id}_${index}`} className="px-4 py-4 text-slate-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function PanelText({ text, tone = "normal" }) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-white text-slate-600";

  return <div className={`rounded-[28px] border p-6 text-sm leading-7 shadow-sm ${className}`}>{text}</div>;
}
