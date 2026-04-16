"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "completed") return "confirmed";
  if (value === "pending") return "draft";
  if (value === "returned") return "cancelled";
  return value || "draft";
}

function money(value) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getDueDate(docData) {
  return (
    toDate(docData.dueDate) ||
    toDate(docData.paymentDueDate) ||
    toDate(docData.maturityDate) ||
    toDate(docData.documentDate) ||
    toDate(docData.invoiceDate) ||
    toDate(docData.createdAt)
  );
}

function bucketKey(dayDiff) {
  if (dayDiff < 0) return "future";
  if (dayDiff <= 30) return "d0_30";
  if (dayDiff <= 60) return "d31_60";
  if (dayDiff <= 90) return "d61_90";
  return "d90_plus";
}

export default function CariAgingReportPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kindFilter, setKindFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [cariSnap, salesSnap, purchasesSnap] = await Promise.all([
          getDocs(collection(db, "caris")),
          getDocs(query(collection(db, "sales"), orderBy("documentDate", "desc"))),
          getDocs(query(collection(db, "purchases"), orderBy("documentDate", "desc"))),
        ]);

        const cariMap = {};
        cariSnap.forEach((docSnap) => {
          cariMap[docSnap.id] = docSnap.data().firm || docSnap.data().name || docSnap.id;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const grouped = {};

        function ensureCari(cariId) {
          if (!grouped[cariId]) {
            grouped[cariId] = {
              cariId,
              cariName: cariMap[cariId] || cariId,
              receivable: { future: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 },
              payable: { future: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 },
              lines: [],
            };
          }
          return grouped[cariId];
        }

        function pushDoc(kind, docData) {
          const status = normalizeStatus(docData.status);
          if (status !== "confirmed") return;

          const outstandingAmount = Number(docData?.settlementSummary?.outstandingAmount || 0) || 0;
          if (outstandingAmount <= 0) return;

          const cariId = kind === "purchase" ? docData.supplierCariId : docData.cariId;
          if (!cariId) return;

          const row = ensureCari(cariId);
          const dueDate = getDueDate(docData);
          const dayDiff = dueDate ? Math.floor((today - dueDate) / 86400000) : 0;
          const key = bucketKey(dayDiff);
          const target = kind === "purchase" ? row.payable : row.receivable;

          target[key] += outstandingAmount;
          target.total += outstandingAmount;
          row.lines.push({
            id: docData.id,
            kind,
            invoiceNo: docData.invoiceNo || docData.documentNo || docData.draftNo || "-",
            dueDate,
            outstandingAmount,
            dayDiff,
            bucket: key,
          });
        }

        salesSnap.docs.forEach((docSnap) => pushDoc("sale", { id: docSnap.id, ...docSnap.data() }));
        purchasesSnap.docs.forEach((docSnap) => pushDoc("purchase", { id: docSnap.id, ...docSnap.data() }));

        setRows(
          Object.values(grouped)
            .map((row) => ({
              ...row,
              netExposure: Number(row.receivable.total || 0) - Number(row.payable.total || 0),
            }))
            .sort(
              (a, b) =>
                Math.max(b.receivable.total, b.payable.total) - Math.max(a.receivable.total, a.payable.total)
            )
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredRows = useMemo(() => {
    const queryText = String(searchQ || "").trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter === "receivable" && row.receivable.total <= 0) return false;
      if (kindFilter === "payable" && row.payable.total <= 0) return false;
      if (!queryText) return true;
      return (
        String(row.cariName || "").toLowerCase().includes(queryText) ||
        String(row.cariId || "").toLowerCase().includes(queryText)
      );
    });
  }, [kindFilter, rows, searchQ]);

  if (loading) {
    return <div className="p-6">Yukleniyor...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cari Yaslandirma Raporu</h1>
          <p className="mt-1 text-sm text-gray-600">
            Acik satis ve satinalma belgelerini vade gunlerine gore grupler.
          </p>
        </div>
        <Link
          href="/satissitok/admin/reports/cari"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cari Raporuna Don
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-white p-4">
        <div>
          <label className="block text-sm">Gorunum</label>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="border p-2"
          >
            <option value="all">Tum Cariler</option>
            <option value="receivable">Alacak Agirlikli</option>
            <option value="payable">Borc Agirlikli</option>
          </select>
        </div>

        <div className="min-w-[260px]">
          <label className="block text-sm">Cari Ara</label>
          <input
            className="w-full border p-2"
            placeholder="Cari adi veya cari id..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Cari</th>
              <th className="border p-2 text-right">Vadesi Gelmeyen</th>
              <th className="border p-2 text-right">0-30</th>
              <th className="border p-2 text-right">31-60</th>
              <th className="border p-2 text-right">61-90</th>
              <th className="border p-2 text-right">90+</th>
              <th className="border p-2 text-right">Toplam Alacak</th>
              <th className="border p-2 text-right">Toplam Borc</th>
              <th className="border p-2 text-right">Net Maruz Kalma</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.cariId}>
                <td className="border p-2">
                  <div className="font-medium text-gray-800">{row.cariName}</div>
                  <div className="text-xs text-gray-500">{row.cariId}</div>
                </td>
                <td className="border p-2 text-right">{money(row.receivable.future + row.payable.future)}</td>
                <td className="border p-2 text-right">{money(row.receivable.d0_30 + row.payable.d0_30)}</td>
                <td className="border p-2 text-right">{money(row.receivable.d31_60 + row.payable.d31_60)}</td>
                <td className="border p-2 text-right">{money(row.receivable.d61_90 + row.payable.d61_90)}</td>
                <td className="border p-2 text-right">{money(row.receivable.d90_plus + row.payable.d90_plus)}</td>
                <td className="border p-2 text-right font-semibold text-emerald-700">{money(row.receivable.total)}</td>
                <td className="border p-2 text-right font-semibold text-red-600">{money(row.payable.total)}</td>
                <td
                  className={`border p-2 text-right font-semibold ${
                    row.netExposure >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {money(row.netExposure)}
                </td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={9} className="border p-4 text-center text-gray-500">
                  Yaslandirma verisi bulunamadi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Rapor Notu</h2>
        <p className="mt-2 text-sm text-gray-600">
          Yaslandirma acik belge mantigi ile hesaplanir. Vade tarihi yoksa belge tarihi kullanilir.
        </p>
      </div>
    </div>
  );
}
