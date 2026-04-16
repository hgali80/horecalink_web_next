"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { ArrowLeft, Home } from "lucide-react";
import { db } from "@/firebase";

function fmtDate(ts) {
  if (!ts?.toDate) return "-";
  return ts.toDate().toLocaleDateString("tr-TR");
}

function movementLabel(type) {
  const map = {
    purchase: "Satinalma",
    purchase_cancel: "Alis Iptali",
    sale: "Satis",
    sale_cancel: "Satis Iptali",
    sale_return: "Satis Iadesi",
    manual_in: "Manuel Giris",
    manual_out: "Manuel Cikis",
    opening_balance: "Acilis",
    wastage: "Fire",
    count_surplus: "Sayim Fazlasi",
    count_shortage: "Sayim Eksigi",
    transfer_in: "Transfer Giris",
    transfer_out: "Transfer Cikis",
  };
  return map[type] || type || "-";
}

export default function StockMovementsListPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, "stock_movements"), orderBy("createdAt", "desc"))
        );
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return rows.filter((row) => {
      const matchesType = !typeFilter || row.type === typeFilter;
      const matchesSearch =
        !q ||
        String(row.productName || "").toLowerCase().includes(q) ||
        String(row.invoiceNo || "").toLowerCase().includes(q) ||
        String(row.note || "").toLowerCase().includes(q) ||
        String(row.referenceNo || "").toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [rows, typeFilter, search]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>
        <Link href="/satissitok/admin" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
        <Link href="/satissitok/admin/stock" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
          <span className="text-sm font-semibold">Stok</span>
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stok Hareketleri</h1>
          <p className="text-sm text-gray-500">Transfer, sayim, fire ve manuel hareketleri merkezi olarak izleyin.</p>
        </div>
        <Link href="/satissitok/admin/stock/movements/new" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Yeni Hareket
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Urun, belge, referans, not"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="rounded-lg border px-3 py-2" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tum tipler</option>
          {Array.from(new Set(rows.map((row) => row.type).filter(Boolean))).map((type) => (
            <option key={type} value={type}>
              {movementLabel(type)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div>Yukleniyor...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2">Tarih</th>
                <th className="border px-3 py-2">Tip</th>
                <th className="border px-3 py-2">Urun</th>
                <th className="border px-3 py-2">Depo</th>
                <th className="border px-3 py-2">Havuz</th>
                <th className="border px-3 py-2">Miktar</th>
                <th className="border px-3 py-2">Belge</th>
                <th className="border px-3 py-2">Aciklama</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2 text-center">{fmtDate(row.createdAt)}</td>
                  <td className="border px-3 py-2 text-center">{movementLabel(row.type)}</td>
                  <td className="border px-3 py-2">
                    <Link href={`/satissitok/admin/stock/${row.productId}`} className="underline">
                      {row.productName || row.productId}
                    </Link>
                  </td>
                  <td className="border px-3 py-2 text-center">{row.warehouseKey || "-"}</td>
                  <td className="border px-3 py-2 text-center">{row.bucket || "-"}</td>
                  <td className="border px-3 py-2 text-center">{row.qty || 0}</td>
                  <td className="border px-3 py-2 text-center">{row.invoiceNo || row.referenceNo || "-"}</td>
                  <td className="border px-3 py-2">{row.note || "-"}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="border px-3 py-6 text-center text-gray-500">
                    Hareket bulunamadi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
