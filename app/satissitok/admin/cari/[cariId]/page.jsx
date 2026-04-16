"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home } from "lucide-react";
import {
  buildRunningBalanceRows,
  listCariTransactions,
  summarizeCariTransactions,
} from "../services/cariTransactions";
import {
  listDocumentSettlementsByCari,
  listDocumentsByCari,
} from "@/app/satissitok/services/documentSettlementService";

function formatDate(value) {
  if (!value) return "-";
  const dt = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("tr-TR");
}

function formatDateTime(value) {
  if (!value) return "-";
  const dt = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("tr-TR");
}

function formatOperationType(type) {
  const map = {
    purchase_invoice: "Satinalma Faturasi",
    purchase_payment: "Tedarikciye Odeme",
    purchase_cancel: "Satinalma Iptal",
    sale_invoice: "Satis Faturasi",
    sale_payment: "Musteri Tahsilati",
    payment_in: "Tahsilat",
    payment_out: "Odeme",
    advance_received: "Avans (Alindi)",
    advance_paid: "Avans (Odendi)",
  };

  return map[type] || type || "-";
}

function formatSettlementStatus(status) {
  if (status === "closed") return "Kapali";
  if (status === "partial") return "Kismi";
  return "Acik";
}

function SettlementBadge({ status }) {
  const tone =
    status === "closed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "partial"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {formatSettlementStatus(status)}
    </span>
  );
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value) {
  return num(value).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtSignedBalance(value) {
  const amount = num(value);
  if (amount > 0) return `+${fmtMoney(amount)}`;
  if (amount < 0) return `-${fmtMoney(Math.abs(amount))}`;
  return fmtMoney(0);
}

export default function CariEkstrePage() {
  const { cariId } = useParams();
  const router = useRouter();

  const [cari, setCari] = useState(null);
  const [rows, setRows] = useState([]);
  const [settlementRows, setSettlementRows] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const loadCari = async () => {
      const ref = doc(db, "caris", cariId);
      const snap = await getDoc(ref);
      setCari(snap.exists() ? snap.data() : null);
    };

    loadCari();
  }, [cariId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [transactionRows, settlementHistory, documentRows] = await Promise.all([
        listCariTransactions({ cariId, fromDate, toDate }),
        listDocumentSettlementsByCari({ cariId, fromDate, toDate }),
        listDocumentsByCari({ cariId }),
      ]);

      setRows(transactionRows);
      setSettlementRows(settlementHistory);
      setDocuments(documentRows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cariId]);

  const rowsWithBalance = useMemo(() => buildRunningBalanceRows(rows), [rows]);
  const summary = useMemo(() => summarizeCariTransactions(rows), [rows]);

  if (!cari) return <div className="p-6">Cari bulunamadi.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
          aria-label="Geri"
          title="Geri"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
          aria-label="Satis/Stok Ana Sayfa"
          title="Satis/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Cari Ekstre</h1>
        <div className="mt-1 text-sm text-gray-600">
          <strong>{cari.firm}</strong> - {cari.type}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Toplam Borc" value={fmtMoney(summary.debit)} tone="red" />
        <SummaryCard title="Toplam Alacak" value={fmtMoney(summary.credit)} tone="green" />
        <SummaryCard title="Net Bakiye" value={fmtSignedBalance(summary.balance)} tone="slate" />
        <SummaryCard
          title="Son Hareket"
          value={summary.lastMovementDate ? formatDate(summary.lastMovementDate) : "-"}
          tone="blue"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm">Baslangic</label>
          <input
            type="date"
            className="border px-3 py-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Bitis</label>
          <input
            type="date"
            className="border px-3 py-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button onClick={loadData} className="rounded bg-blue-600 px-4 py-2 text-white">
          Filtrele
        </button>
      </div>

      {loading ? (
        <div>Yukleniyor...</div>
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Cari Hareketleri</h2>
              <p className="text-sm text-slate-500">
                Borc, alacak ve kosan bakiye hareketlerini tek tabloda izleyin.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-2">Tarih</th>
                    <th className="border px-2 py-2">Islem Turu</th>
                    <th className="border px-2 py-2">Belge No</th>
                    <th className="border px-2 py-2 text-right">Borc</th>
                    <th className="border px-2 py-2 text-right">Alacak</th>
                    <th className="border px-2 py-2 text-right">Bakiye</th>
                    <th className="border px-2 py-2">Aciklama</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWithBalance.map((row) => (
                    <tr key={row.id}>
                      <td className="border px-2 py-1 text-center">{formatDate(row.operationDate)}</td>
                      <td className="border px-2 py-1 text-center">
                        {formatOperationType(row.operationType)}
                      </td>
                      <td className="border px-2 py-1 text-center">{row.documentNo || "-"}</td>
                      <td className="border px-2 py-1 text-right">
                        {row.debit ? fmtMoney(row.debit) : "-"}
                      </td>
                      <td className="border px-2 py-1 text-right">
                        {row.credit ? fmtMoney(row.credit) : "-"}
                      </td>
                      <td className="border px-2 py-1 text-right font-medium">
                        {fmtSignedBalance(row.balance)}
                      </td>
                      <td className="border px-2 py-1">{row.note || ""}</td>
                    </tr>
                  ))}

                  {rowsWithBalance.length === 0 && (
                    <tr>
                      <td colSpan={7} className="border px-3 py-6 text-center text-gray-500">
                        Hareket bulunamadi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Belge Kapanis Ozeti</h2>
              <p className="text-sm text-slate-500">
                Acik, kismi ve kapali belgeleri cari bazinda toplu olarak gorun.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-2">Belge</th>
                    <th className="border px-2 py-2">Tur</th>
                    <th className="border px-2 py-2">Tarih</th>
                    <th className="border px-2 py-2 text-right">Belge Tutari</th>
                    <th className="border px-2 py-2 text-right">Kapanan</th>
                    <th className="border px-2 py-2 text-right">Acik</th>
                    <th className="border px-2 py-2">Durum</th>
                    <th className="border px-2 py-2">Son Kapanis</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((row) => (
                    <tr key={`${row.kind}-${row.id}`}>
                      <td className="border px-2 py-1 text-center">{row.invoiceNo}</td>
                      <td className="border px-2 py-1 text-center">
                        {row.kind === "purchase" ? "Satinalma" : "Satis"}
                      </td>
                      <td className="border px-2 py-1 text-center">{formatDate(row.documentDate)}</td>
                      <td className="border px-2 py-1 text-right">{fmtMoney(row.invoiceAmount)}</td>
                      <td className="border px-2 py-1 text-right">{fmtMoney(row.settledAmount)}</td>
                      <td className="border px-2 py-1 text-right">{fmtMoney(row.outstandingAmount)}</td>
                      <td className="border px-2 py-1 text-center">
                        <SettlementBadge status={row.status} />
                      </td>
                      <td className="border px-2 py-1 text-center">
                        {row.lastSettlementAt ? formatDateTime(row.lastSettlementAt) : "-"}
                      </td>
                    </tr>
                  ))}

                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={8} className="border px-3 py-6 text-center text-gray-500">
                        Bu cari icin kapanis takibi olan belge bulunamadi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Settlement Gecmisi</h2>
              <p className="text-sm text-slate-500">
                Belgeye bagli tahsilat ve odeme hareketlerini satir bazinda inceleyin.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-2">Tarih</th>
                    <th className="border px-2 py-2">Belge</th>
                    <th className="border px-2 py-2">Tur</th>
                    <th className="border px-2 py-2">Makbuz</th>
                    <th className="border px-2 py-2">Yontem</th>
                    <th className="border px-2 py-2 text-right">Tutar</th>
                    <th className="border px-2 py-2">Aciklama</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border px-2 py-1 text-center">{formatDateTime(row.operationDate)}</td>
                      <td className="border px-2 py-1 text-center">{row.invoiceNo || "-"}</td>
                      <td className="border px-2 py-1 text-center">
                        {row.kind === "purchase" ? "Odeme" : "Tahsilat"}
                      </td>
                      <td className="border px-2 py-1 text-center">{row.receiptNo || "-"}</td>
                      <td className="border px-2 py-1 text-center">{row.method || "-"}</td>
                      <td className="border px-2 py-1 text-right">{fmtMoney(row.amount)}</td>
                      <td className="border px-2 py-1">{row.description || "-"}</td>
                    </tr>
                  ))}

                  {settlementRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="border px-3 py-6 text-center text-gray-500">
                        Bu tarih araliginda settlement gecmisi bulunamadi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value, tone }) {
  const tones = {
    red: "text-red-600",
    green: "text-emerald-700",
    slate: "text-slate-900",
    blue: "text-blue-700",
  };

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`mt-2 text-xl font-bold ${tones[tone] || "text-slate-900"}`}>{value}</div>
    </div>
  );
}
