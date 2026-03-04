// app/satissitok/admin/finance/expenses/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";

function fmtDate(ts) {
  if (!ts?.toDate) return "-";
  return ts.toDate().toLocaleDateString("tr-TR");
}
function money(n) {
  return Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ExpensesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "cash_transactions"),
        where("txType", "==", "expense"),
        orderBy("operationDate", "desc")
      );
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    let net = 0, vat = 0, gross = 0;
    for (const r of rows) {
      net += Number(r.amountNet ?? r.amount ?? 0) || 0;
      vat += Number(r.vatAmount ?? 0) || 0;
      gross += Number(r.amountGross ?? r.amount ?? 0) || 0;
    }
    return { net, vat, gross };
  }, [rows]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>

        <div className="ml-auto">
          <Link
            href="/satissitok/admin/finance/expenses/new"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <PlusCircle size={18} />
            Yeni Gider
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Giderler</h1>
        <div className="text-sm text-gray-600 mt-1">
          Operasyonel gider kayıtları (cash_transactions / txType=expense)
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi title="Net" value={money(totals.net)} />
        <Kpi title="KDV" value={money(totals.vat)} />
        <Kpi title="Brüt" value={money(totals.gross)} />
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2">Tarih</th>
              <th className="border px-2 py-2">Kategori</th>
              <th className="border px-2 py-2">Yöntem</th>
              <th className="border px-2 py-2 text-right">Net</th>
              <th className="border px-2 py-2 text-right">KDV</th>
              <th className="border px-2 py-2 text-right">Brüt</th>
              <th className="border px-2 py-2">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="border px-3 py-6 text-center text-gray-500">Yükleniyor…</td></tr>
            )}

            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td className="border px-2 py-1 text-center">{fmtDate(r.operationDate)}</td>
                <td className="border px-2 py-1">{r.categoryName || "-"}</td>
                <td className="border px-2 py-1 text-center">{r.method || "-"}</td>
                <td className="border px-2 py-1 text-right">{money(r.amountNet ?? r.amount ?? 0)}</td>
                <td className="border px-2 py-1 text-right">{money(r.vatAmount ?? 0)}</td>
                <td className="border px-2 py-1 text-right">{money(r.amountGross ?? r.amount ?? 0)}</td>
                <td className="border px-2 py-1">{r.description || ""}</td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="border px-3 py-6 text-center text-gray-500">Gider bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}