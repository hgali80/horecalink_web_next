// app/satissitok/admin/finance/cash/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

function fmtDate(ts) {
  if (!ts?.toDate) return "-";
  return ts.toDate().toLocaleDateString("tr-TR");
}

export default function CashMovementsPage() {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [accountId, setAccountId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const constraints = [orderBy("operationDate", "desc"), orderBy("createdAt", "desc")];
      if (accountId) constraints.unshift(where("accountId", "==", accountId));
      if (fromDate) {
        constraints.unshift(
          where("operationDate", ">=", Timestamp.fromDate(new Date(fromDate)))
        );
      }
      if (toDate) {
        constraints.unshift(
          where("operationDate", "<=", Timestamp.fromDate(new Date(toDate)))
        );
      }

      const q = query(collection(db, "cash_transactions"), ...constraints);
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const totals = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    for (const r of rows) {
      const amt = Number(r.amount || 0) || 0;
      if (r.direction === "in") incoming += amt;
      if (r.direction === "out") outgoing += amt;
    }
    return {
      incoming: Math.round(incoming * 100) / 100,
      outgoing: Math.round(outgoing * 100) / 100,
      net: Math.round((incoming - outgoing) * 100) / 100,
    };
  }, [rows]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
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

        <Link
          href="/satissitok/admin/finance"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Finans"
          title="Finans"
        >
          <span className="text-sm font-semibold">Finans</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Kasa/Banka Hareketleri</h1>
        <div className="text-sm text-gray-600 mt-1">
          Gelen: {totals.incoming.toLocaleString()} ₸ • Giden: {totals.outgoing.toLocaleString()} ₸ • Net: {totals.net.toLocaleString()} ₸
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm mb-1">Başlangıç</label>
          <input type="date" className="border px-3 py-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Bitiş</label>
          <input type="date" className="border px-3 py-2" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">AccountId (opsiyonel)</label>
          <input className="border px-3 py-2" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="cash_accounts id" />
        </div>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded">
          Filtrele
        </button>
      </div>

      {loading ? (
        <div>Yükleniyor…</div>
      ) : (
        <table className="w-full border border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2">Tarih</th>
              <th className="border px-2 py-2">Yön</th>
              <th className="border px-2 py-2">Makbuz</th>
              <th className="border px-2 py-2">Belge</th>
              <th className="border px-2 py-2">Cari</th>
              <th className="border px-2 py-2">Yöntem</th>
              <th className="border px-2 py-2 text-right">Tutar</th>
              <th className="border px-2 py-2">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="border px-2 py-1 text-center">{fmtDate(r.operationDate)}</td>
                <td className="border px-2 py-1 text-center">{r.direction}</td>
                <td className="border px-2 py-1 text-center">{r.receiptNo || "-"}</td>
                <td className="border px-2 py-1 text-center">{r.documentNo || "-"}</td>
                <td className="border px-2 py-1 text-center">
                  {r.cariId ? (
                    <Link className="underline" href={`/satissitok/admin/cari/${r.cariId}`}>
                      Detay
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="border px-2 py-1 text-center">{r.method || "-"}</td>
                <td className="border px-2 py-1 text-right">{Number(r.amount || 0).toLocaleString()}</td>
                <td className="border px-2 py-1">{r.description || ""}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="border px-3 py-6 text-center text-gray-500">
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
