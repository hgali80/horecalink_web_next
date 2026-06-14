"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErpSectionHeader from "../_components/ErpSectionHeader";
import {
  listErpStockBalances,
  listErpStockMovements,
} from "../_services/erpStockService";

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KZT`;
}

export default function ErpStockPage() {
  const [balances, setBalances] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const [nextBalances, nextMovements] = await Promise.all([
          listErpStockBalances(),
          listErpStockMovements(),
        ]);
        if (!alive) return;
        setBalances(nextBalances);
        setMovements(nextMovements.slice(0, 18));
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Stok verileri yuklenemedi.");
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
      productCount: balances.length,
      positiveCount: balances.filter((item) => item.totalQty > 0).length,
      negativeCount: balances.filter((item) => item.totalQty < 0).length,
    };
  }, [balances]);

  return (
    <div className="space-y-6">
      <ErpSectionHeader
        eyebrow="ERP / Stok"
        title="Stok Merkezi"
        description="R/F stok havuzlari, urun bazli hareketler, negatif stok takibi ve maliyet gorunurlugu bu modulde yonetilecek."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Toplam Urun" value={String(metrics.productCount)} />
        <MetricCard label="Stoklu Urun" value={String(metrics.positiveCount)} />
        <MetricCard label="Eksi Stok" value={String(metrics.negativeCount)} />
      </div>

      {loading ? (
        <PanelText text="Stok merkezi hazirlaniyor..." />
      ) : error ? (
        <PanelText tone="error" text={error} />
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Urun Bazli Stok ve Maliyet</h3>
              <div className="text-sm text-slate-500">
                Urun adina tiklayarak stok karti ve alis gecmisine girebilirsin
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <Th>Urun</Th>
                      <Th>Kod</Th>
                      <Th>Web</Th>
                      <Th align="right">R Stok</Th>
                      <Th align="right">F Stok</Th>
                      <Th align="right">Toplam</Th>
                      <Th align="right">R Ort. Maliyet</Th>
                      <Th align="right">F Ort. Maliyet</Th>
                      <Th>Guncelleme</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <Td>
                          <Link
                            href={`/satissitok/admin/erp/stock/${row.id}`}
                            className="font-semibold text-[#1d3246] transition hover:text-[#243f58]"
                          >
                            {row.name}
                          </Link>
                          <div className="text-xs text-slate-500">{row.brand || "-"}</div>
                        </Td>
                        <Td>{row.sku || "-"}</Td>
                        <Td>{row.webPublished ? "yayinda" : "kapali"}</Td>
                        <Td align="right">{row.rQty}</Td>
                        <Td align="right">{row.fQty}</Td>
                        <Td align="right">
                          <span className={toneClass(row.totalQty)}>{row.totalQty}</span>
                        </Td>
                        <Td align="right">{fmtMoney(row.rAvgCost)}</Td>
                        <Td align="right">{fmtMoney(row.fAvgCost)}</Td>
                        <Td>{row.updatedLabel}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Son Stok Hareketleri</h3>
              <div className="text-sm text-slate-500">Maliyet etkisiyle birlikte gorunur</div>
            </div>

            {!movements.length ? (
              <PanelText text="Henuz stok hareketi yok. Onayli satinalma ve satis belgeleri geldikce bu alan dolacak." />
            ) : (
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <Th>Urun</Th>
                        <Th>Tur</Th>
                        <Th>Kova</Th>
                        <Th align="right">Miktar</Th>
                        <Th align="right">Birim Maliyet</Th>
                        <Th align="right">Toplam Maliyet</Th>
                        <Th>Belge</Th>
                        <Th>Cari</Th>
                        <Th>Fallback</Th>
                        <Th>Tarih</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <Td>
                            <div className="font-semibold text-slate-900">{row.productName}</div>
                            <div className="text-xs text-slate-500">{row.productSku || "-"}</div>
                          </Td>
                          <Td>{row.movementType}</Td>
                          <Td>{row.bucket}</Td>
                          <Td align="right">{row.quantity}</Td>
                          <Td align="right">{fmtMoney(row.effectiveUnitCost)}</Td>
                          <Td align="right">{fmtMoney(row.effectiveLineCost)}</Td>
                          <Td>{row.documentNo || "-"}</Td>
                          <Td>{row.cariName || "-"}</Td>
                          <Td>
                            {row.usedCostFallback ? (
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                                {row.costBucketUsed || "fallback"}
                              </span>
                            ) : (
                              "-"
                            )}
                          </Td>
                          <Td>{row.dateLabel}</Td>
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

function toneClass(value) {
  if (value > 0) return "font-bold text-emerald-700";
  if (value < 0) return "font-bold text-rose-700";
  return "font-bold text-slate-500";
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#1d3246]">{value}</div>
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
