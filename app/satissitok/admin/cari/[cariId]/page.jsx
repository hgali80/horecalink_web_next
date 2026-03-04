// app/satissitok/admin/cari/[cariId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home } from "lucide-react";
import { listCariTransactions } from "../services/cariTransactions";

function formatDate(d) {
  if (!d) return "-";
  const dt = d.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString("tr-TR");
}

function formatOperationType(type) {
  const map = {
    purchase_invoice: "Satınalma Faturası",
    purchase_payment: "Tedarikçiye Ödeme",
    purchase_cancel: "Satınalma İptal",
    sale_invoice: "Satış Faturası",
    sale_payment: "Müşteri Tahsilatı",
    payment_in: "Tahsilat",
    payment_out: "Ödeme",
    advance_received: "Avans (Alındı)",
    advance_paid: "Avans (Ödendi)",
  };

  return map[type] || type || "-";
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n) {
  const x = num(n);
  return x.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * ✅ Backward compatible:
 * - New model: { direction: "debit"|"credit", amount }
 * - Old model: { debit, credit }
 * - Some older docs: { type: "debit"|"credit", amount }
 */
function pickDebitCredit(r) {
  const direction = (r?.direction || r?.type || "").toString().toLowerCase();
  const amount = num(r?.amount);

  if (direction === "debit") return { debit: amount, credit: 0 };
  if (direction === "credit") return { debit: 0, credit: amount };

  // fallback legacy
  return { debit: num(r?.debit), credit: num(r?.credit) };
}

function fmtSignedBalance(n) {
  const x = num(n);
  if (x > 0) return `+${fmtMoney(x)}`;
  if (x < 0) return `-${fmtMoney(Math.abs(x))}`;
  return fmtMoney(0);
}

export default function CariEkstrePage() {
  const { cariId } = useParams();
  const router = useRouter();

  const [cari, setCari] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Cari bilgisi
  useEffect(() => {
    const loadCari = async () => {
      const ref = doc(db, "caris", cariId);
      const snap = await getDoc(ref);
      setCari(snap.exists() ? snap.data() : null);
    };
    loadCari();
  }, [cariId]);

  // Hareketler
  const loadTransactions = async () => {
    setLoading(true);
    const data = await listCariTransactions({ cariId, fromDate, toDate });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line
  }, [cariId]);

  // ✅ Koşan bakiye (direction+amount destekli)
  const rowsWithBalance = useMemo(() => {
    let balance = 0;

    return rows.map((r) => {
      const { debit, credit } = pickDebitCredit(r);
      balance += debit - credit;

      return { ...r, debit, credit, balance };
    });
  }, [rows]);

  if (!cari) return <div className="p-6">Cari bulunamadı.</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Top Nav */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Geri"
          title="Geri"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Satış/Stok Ana Sayfa"
          title="Satış/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold">Cari Ekstre</h1>
        <div className="text-sm text-gray-600 mt-1">
          <strong>{cari.firm}</strong> — {cari.type}
        </div>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm mb-1">Başlangıç</label>
          <input
            type="date"
            className="border px-3 py-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Bitiş</label>
          <input
            type="date"
            className="border px-3 py-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button
          onClick={loadTransactions}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Filtrele
        </button>
      </div>

      {/* Tablo */}
      {loading ? (
        <div>Yükleniyor…</div>
      ) : (
        <table className="w-full border border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2">Tarih</th>
              <th className="border px-2 py-2">İşlem Türü</th>
              <th className="border px-2 py-2">Belge No</th>
              <th className="border px-2 py-2 text-right">Borç</th>
              <th className="border px-2 py-2 text-right">Alacak</th>
              <th className="border px-2 py-2 text-right">Bakiye</th>
              <th className="border px-2 py-2">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithBalance.map((r) => (
              <tr key={r.id}>
                <td className="border px-2 py-1 text-center">
                  {formatDate(r.operationDate)}
                </td>
                <td className="border px-2 py-1 text-center">
                  {formatOperationType(r.operationType)}
                </td>
                <td className="border px-2 py-1 text-center">
                  {r.documentNo || "-"}
                </td>
                <td className="border px-2 py-1 text-right">
                  {r.debit ? fmtMoney(r.debit) : "-"}
                </td>
                <td className="border px-2 py-1 text-right">
                  {r.credit ? fmtMoney(r.credit) : "-"}
                </td>
                <td className="border px-2 py-1 text-right font-medium">
                  {fmtSignedBalance(r.balance)}
                </td>
                <td className="border px-2 py-1">
                  {r.description || r.note || ""}
                </td>
              </tr>
            ))}

            {rowsWithBalance.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="border px-3 py-6 text-center text-gray-500"
                >
                  Hareket bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}