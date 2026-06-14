"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErpSectionHeader from "../_components/ErpSectionHeader";
import { listErpCaris } from "../_services/erpCarisService";

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KZT`;
}

export default function ErpCarisPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const nextRows = await listErpCaris();
        if (!alive) return;
        setRows(nextRows);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Cari listesi yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (type !== "all" && row.typeLabel !== type) return false;
      if (!needle) return true;

      return [row.name, row.code, row.phone, row.email, row.typeLabel]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, rows, type]);

  const metrics = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((item) => item.isActive).length,
      mixed: rows.filter((item) => item.typeLabel === "musteri + tedarikci").length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <ErpSectionHeader
          eyebrow="ERP / Cariler"
          title="Cari Merkezi"
          description="Tek cari kart mantigi ile musteri, tedarikci ve ortak cariler burada yonetilecek. Acik bakiye, belge iliskisi ve belge ekranlarindaki cari secimi bu koleksiyonla beslenecek."
        />

        <Link
          href="/satissitok/admin/erp/caris/new"
          className="inline-flex items-center justify-center rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58]"
        >
          Yeni Cari
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Toplam Cari" value={String(metrics.total)} />
        <MetricCard label="Aktif Cari" value={String(metrics.active)} />
        <MetricCard label="Ortak Cari" value={String(metrics.mixed)} />
      </div>

      <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.4fr_0.8fr]">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Cari adi, kod, telefon veya e-posta ara"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
        />

        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
        >
          <option value="all">Tum tipler</option>
          <option value="musteri">Sadece musteri</option>
          <option value="tedarikci">Sadece tedarikci</option>
          <option value="musteri + tedarikci">Ortak cari</option>
          <option value="genel">Genel</option>
        </select>
      </div>

      {loading ? (
        <PanelText text="Cari listesi hazirlaniyor..." />
      ) : error ? (
        <PanelText tone="error" text={error} />
      ) : !filtered.length ? (
        <PanelText text="Henuz `erp_caris` koleksiyonunda kayit yok. Bu ekrandan ilk cari kartini olusturabilirsin." />
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>Cari</Th>
                  <Th>Kod</Th>
                  <Th>Tip</Th>
                  <Th>Iletisim</Th>
                  <Th align="right">Alacak</Th>
                  <Th align="right">Borc</Th>
                  <Th>Guncelleme</Th>
                  <Th>Islem</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <Td>
                      <div className="font-semibold text-slate-900">{row.name || "-"}</div>
                      <div className="text-xs text-slate-500">{row.isActive ? "aktif" : "pasif"}</div>
                    </Td>
                    <Td>{row.code || "-"}</Td>
                    <Td>{row.typeLabel}</Td>
                    <Td>
                      <div>{row.phone || "-"}</div>
                      <div className="text-xs text-slate-500">{row.email || "-"}</div>
                    </Td>
                    <Td align="right">{fmtMoney(row.receivable)}</Td>
                    <Td align="right">{fmtMoney(row.payable)}</Td>
                    <Td>{row.updatedLabel}</Td>
                    <Td>
                      <Link
                        href={`/satissitok/admin/erp/caris/${row.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        Detay
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
