"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getErpStockCard } from "../../_services/erpStockService";

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KZT`;
}

export default function ErpStockCardPage({ params }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [card, setCard] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const next = await getErpStockCard(params.productId);
        if (!alive) return;
        setCard(next);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Stok karti yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [params.productId]);

  if (loading) {
    return <PanelText text="Stok karti hazirlaniyor..." />;
  }

  if (error || !card) {
    return <PanelText tone="error" text={error || "Stok karti bulunamadi."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
            ERP / Stok / Urun Karti
          </div>
          <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">
            {card.product.name}
          </h2>
          <p className="text-sm text-slate-500">
            {card.product.sku || "-"} · {card.product.brand || "-"} · {card.product.unit || "adet"}
          </p>
        </div>

        <Link
          href="/satissitok/admin/erp/stock"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Stok Merkezine Don
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="R Stok" value={String(card.balance.rQty)} />
        <MetricCard label="F Stok" value={String(card.balance.fQty)} />
        <MetricCard label="Toplam" value={String(card.balance.totalQty)} />
        <MetricCard label="R Ort. Maliyet" value={fmtMoney(card.balance.rAvgCost)} />
        <MetricCard label="F Ort. Maliyet" value={fmtMoney(card.balance.fAvgCost)} />
        <MetricCard label="Fallback Sayisi" value={String(card.summary.fallbackCount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryBox
          title="Son Alis Maliyeti"
          value={fmtMoney(card.summary.lastPurchaseCost)}
          note={`${card.summary.purchaseCount} satinalma hareketi`}
        />
        <SummaryBox
          title="Son Satis Maliyeti"
          value={fmtMoney(card.summary.lastSaleCost)}
          note={`${card.summary.saleCount} satis hareketi`}
        />
        <SummaryBox
          title="Web Durumu"
          value={card.product.webPublished ? "Yayinda" : "Kapali"}
          note={card.product.stockTracked ? "stok takipli" : "stok takip disi"}
        />
      </div>

      <SectionTable
        title="Alis Gecmisi"
        emptyText="Bu urun icin satinalma hareketi yok."
        rows={card.purchases}
      />

      <SectionTable
        title="Satis Gecmisi"
        emptyText="Bu urun icin satis hareketi yok."
        rows={card.sales}
      />

      <SectionTable
        title="Maliyet Fallback Kayitlari"
        emptyText="Fallback kullanilan hareket yok."
        rows={card.fallbacks}
        highlightFallback
      />
    </div>
  );
}

function SectionTable({ title, emptyText, rows, highlightFallback = false }) {
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
                  <Th>Tarih</Th>
                  <Th>Tur</Th>
                  <Th>Kova</Th>
                  <Th align="right">Miktar</Th>
                  <Th align="right">Birim Maliyet</Th>
                  <Th align="right">Toplam Maliyet</Th>
                  <Th>Cari</Th>
                  <Th>Belge</Th>
                  {highlightFallback ? <Th>Fallback</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <Td>{row.dateLabel}</Td>
                    <Td>{row.movementType}</Td>
                    <Td>{row.bucket}</Td>
                    <Td align="right">{row.quantity}</Td>
                    <Td align="right">{fmtMoney(row.effectiveUnitCost)}</Td>
                    <Td align="right">{fmtMoney(row.effectiveLineCost)}</Td>
                    <Td>{row.cariName || "-"}</Td>
                    <Td>{row.documentNo || "-"}</Td>
                    {highlightFallback ? (
                      <Td>
                        {row.usedCostFallback ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            {row.costBucketUsed || "fallback"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </Td>
                    ) : null}
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

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#1d3246]">{value}</div>
    </div>
  );
}

function SummaryBox({ title, value, note }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#1d3246]">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{note}</div>
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
