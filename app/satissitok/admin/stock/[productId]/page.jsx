//app/satissitok/admin/stock/[productId]/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, Home } from "lucide-react";
import { listProductCostEntriesByProduct } from "@/app/satissitok/services/inventoryCostService";

function fmtMoney(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(ts) {
  if (!ts?.toDate) return "-";
  const d = ts.toDate();
  return d.toLocaleDateString("tr-TR");
}

function typeLabel(value) {
  const type = String(value || "").trim().toLowerCase();
  if (type === "purchase") return "Satinalma";
  if (type === "purchase_cancel") return "Alis Iptali";
  if (type === "sale") return "Satis";
  if (type === "sale_cancel") return "Satis Iptali";
  if (type === "sale_return") return "Satis Iadesi";
  if (type === "manual_in") return "Manuel Giris";
  if (type === "manual_out") return "Manuel Cikis";
  if (type === "opening_balance") return "Acilis";
  if (type === "wastage") return "Fire";
  if (type === "count_surplus") return "Sayim Fazlasi";
  if (type === "count_shortage") return "Sayim Eksigi";
  if (type === "transfer_in") return "Transfer Giris";
  if (type === "transfer_out") return "Transfer Cikis";
  return value || "-";
}

export default function StockMovementsPage() {
  const { productId } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [costEntries, setCostEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔹 Ürün bilgisi (doğrudan doc oku)
  useEffect(() => {
    const loadProduct = async () => {
      try {
        const ref = doc(db, "products", productId);
        const snap = await getDoc(ref);
        setProduct(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (e) {
        console.error("PRODUCT LOAD ERROR:", e);
      }
    };
    loadProduct();
  }, [productId]);

  // 🔹 Stok hareketleri
  useEffect(() => {
    const loadMovements = async () => {
      try {
        const [snap, loadedCostEntries] = await Promise.all([
          getDocs(
            query(
              collection(db, "stock_movements"),
              where("productId", "==", productId),
              orderBy("createdAt", "desc")
            )
          ),
          listProductCostEntriesByProduct(productId),
        ]);
        setMovements(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setCostEntries(loadedCostEntries);
      } catch (e) {
        console.error("STOCK MOVEMENTS ERROR:", e);
        setError(
          "Stok hareketleri yüklenemedi. Büyük ihtimalle Firestore index eksik."
        );
      } finally {
        setLoading(false);
      }
    };

    loadMovements();
  }, [productId]);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Yükleniyor...</div>;
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
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

        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
      </div>
    );
  }

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

      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-blue-600">
          ← Geri
        </button>
        <h1 className="text-2xl font-bold">Stok Hareketleri</h1>
      </div>

      <div className="text-gray-700">
        <div>
          <strong>Ürün:</strong> {product?.name || productId}
        </div>
        <div>
          <strong>Birim:</strong> {product?.unit || "-"}
        </div>
        <div>
          <strong>Satis Fiyati:</strong> {fmtMoney(product?.price || 0)} â‚¸
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2">Tarih</th>
              <th className="border px-3 py-2">Tur</th>
              <th className="border px-3 py-2">Tedarikci</th>
              <th className="border px-3 py-2">Belge</th>
              <th className="border px-3 py-2">Miktar</th>
              <th className="border px-3 py-2">Brut Birim</th>
              <th className="border px-3 py-2">Net Birim</th>
            </tr>
          </thead>

          <tbody>
            {costEntries.slice(0, 12).map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2 text-center">
                  {fmtDate(entry.documentDate || entry.createdAt)}
                </td>
                <td className="border px-3 py-2 text-center">{entry.entryType || "-"}</td>
                <td className="border px-3 py-2">{entry.supplierName || "-"}</td>
                <td className="border px-3 py-2">{entry.invoiceNo || "-"}</td>
                <td className="border px-3 py-2 text-center">{entry.qty || 0}</td>
                <td className="border px-3 py-2 text-right">
                  {fmtMoney(entry.grossUnitCost || 0)} â‚¸
                </td>
                <td className="border px-3 py-2 text-right">
                  {fmtMoney(entry.netUnitCost || 0)} â‚¸
                </td>
              </tr>
            ))}

            {costEntries.length === 0 && (
              <tr>
                <td colSpan={7} className="border px-3 py-6 text-center text-gray-500">
                  Maliyet gecmisi bulunamadi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2">Tarih</th>
              <th className="border px-3 py-2">Tür</th>
              <th className="border px-3 py-2">Resmi / Fiili</th>
              <th className="border px-3 py-2">Fatura No</th>
              <th className="border px-3 py-2">Tedarikçi</th>
              <th className="border px-3 py-2">Miktar</th>
              <th className="border px-3 py-2">Birim Maliyet</th>
              <th className="border px-3 py-2">Toplam</th>
            </tr>
          </thead>

          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2 text-center">{fmtDate(m.createdAt)}</td>
                <td className="border px-3 py-2 text-center">
                  {typeLabel(m.type)}
                </td>
                <td className="border px-3 py-2 text-center">
                  {m.purchaseType === "official"
                    ? "Resmi"
                    : m.purchaseType === "actual"
                    ? "Fiili"
                    : "-"}
                </td>
                <td className="border px-3 py-2">{m.invoiceNo || "-"}</td>
                <td className="border px-3 py-2">{m.supplierName || "-"}</td>
                <td className="border px-3 py-2 text-center">{m.qty}</td>
                <td className="border px-3 py-2 text-right">{fmtMoney(m.unitCost)} ₸</td>
                <td className="border px-3 py-2 text-right">{fmtMoney(m.totalCost)} ₸</td>
              </tr>
            ))}

            {movements.length === 0 && (
              <tr>
                <td colSpan={8} className="border px-3 py-6 text-center text-gray-500">
                  Stok hareketi bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
