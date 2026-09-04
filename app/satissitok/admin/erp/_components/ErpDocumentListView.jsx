"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import ErpSalesPdfButton from "./ErpSalesPdfButton";

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KZT`;
}

function statusTone(status) {
  if (status === "confirmed") return "bg-emerald-50 text-emerald-700";
  if (status === "cancelled") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function ErpDocumentListView({
  title,
  description,
  rows,
  emptyTitle,
  emptyText,
  newHref = null,
  newLabel = "Yeni Belge",
  editHrefBase = "",
  salesPdfEnabled = false,
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [docType, setDocType] = useState("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows || []).filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (docType !== "all" && row.docType !== docType) return false;
      if (!needle) return true;

      const haystack = [
        row.documentNo,
        row.invoiceNo,
        row.draftNo,
        row.cariName,
        row.dateLabel,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [docType, q, rows, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">{title}</h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>

        {newHref ? (
          <Link
            href={newHref}
            className="inline-flex items-center justify-center rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58]"
          >
            {newLabel}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Belge no, fatura no, draft no veya cari ara"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
        >
          <option value="all">Tum durumlar</option>
          <option value="draft">Taslak</option>
          <option value="confirmed">Onayli</option>
          <option value="cancelled">Iptal</option>
        </select>

        <select
          value={docType}
          onChange={(event) => setDocType(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
        >
          <option value="all">Tum belge tipleri</option>
          <option value="R">Sadece R</option>
          <option value="F">Sadece F</option>
        </select>
      </div>

      {!filtered.length ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{emptyTitle}</div>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>Tip</Th>
                  <Th>Durum</Th>
                  <Th>Draft No</Th>
                  <Th>Belge No</Th>
                  <Th>Fatura No</Th>
                  <Th>Cari</Th>
                  <Th>Tarih</Th>
                  <Th align="right">Toplam</Th>
                  <Th>Tahsilat / Odeme</Th>
                  <Th>Islem</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <Td>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {row.docType}
                      </span>
                    </Td>
                    <Td>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(row.status)}`}>
                        {row.status}
                      </span>
                    </Td>
                    <Td>{row.draftNo || "-"}</Td>
                    <Td>{row.documentNo || "-"}</Td>
                    <Td>{row.invoiceNo || "-"}</Td>
                    <Td>{row.cariName || "-"}</Td>
                    <Td>{row.dateLabel}</Td>
                    <Td align="right">{fmtMoney(row.totalAmount)}</Td>
                    <Td>{row.paymentStatus || "-"}</Td>
                    <Td>
                      {salesPdfEnabled ? <div className="mb-2"><ErpSalesPdfButton documentId={row.id} /></div> : null}
                      {editHrefBase ? (
                        <Link
                          href={`${editHrefBase}/${row.id}`}
                          className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
                        >
                          Duzenle
                        </Link>
                      ) : (
                        "-"
                      )}
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
