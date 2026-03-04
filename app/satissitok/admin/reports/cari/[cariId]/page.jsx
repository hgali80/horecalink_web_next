//app/satissitok/admin/reports/cari/[cariId]/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase";

function money(n) {
  return Number(n || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(ts) {
  if (!ts?.toDate) return "-";
  return ts.toDate().toLocaleString();
}

export default function CariDetailPage() {
  const { cariId } = useParams();

  const [cari, setCari] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cariId]);

  async function loadData() {
    setLoading(true);

    // Cari kart
    const cariSnap = await getDoc(doc(db, "caris", cariId));
    if (cariSnap.exists()) {
      setCari(cariSnap.data());
    } else {
      setCari(null);
    }

    // Cari hareketler
    const q = query(
      collection(db, "cari_transactions"),
      where("cariId", "==", cariId),
      orderBy("createdAt", "asc")
    );

    const snap = await getDocs(q);

    let balance = 0;
    const table = [];

    snap.forEach((d) => {
      const t = d.data();

      // ✅ Alan fallback'leri (asıl fix burada)
      const type = (t.type || "").toString().trim(); // debit | credit
      const source = (t.source ?? "-")?.toString?.() ?? "-";
      const refId = (t.refId ?? t.documentNo ?? t.invoiceNo ?? "-")?.toString?.() ?? "-";

      // Bazı kayıtlar operationDate kullanıyor olabilir
      const date = t.operationDate || t.createdAt;

      const amt = Number(t.amount ?? t.total ?? t.grandTotal ?? 0);

      // Bakiye hesabı
      if (type === "debit") balance += amt;
      else if (type === "credit") balance -= amt;

      table.push({
        id: d.id,
        date,
        type,
        source,
        refId,
        amount: amt,
        balance,
        note: t.note || t.description || "",
      });
    });

    setRows(table);
    setLoading(false);
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Cari Detayı</h1>

      {/* Cari Bilgi */}
      <div className="border p-4 space-y-1">
        <div>
          <b>Firma:</b> {cari?.firm || "-"}
        </div>
        <div>
          <b>Telefon:</b> {cari?.mobile || "-"}
        </div>
        <div>
          <b>Para Birimi:</b> {cari?.currency || "KZT"}
        </div>
      </div>

      {/* Hareketler */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1">Tarih</th>
              <th className="border p-1">Tür</th>
              <th className="border p-1">Kaynak</th>
              <th className="border p-1">Ref</th>
              <th className="border p-1 text-right">Tutar</th>
              <th className="border p-1 text-right">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i}>
                <td className="border p-1">{formatDate(r.date)}</td>

                <td className="border p-1">
                  {r.type === "debit"
                    ? "Borç"
                    : r.type === "credit"
                    ? "Alacak"
                    : "?"}
                </td>

                <td className="border p-1">{r.source || "-"}</td>

                <td className="border p-1">{r.refId || "-"}</td>

                <td
                  className={`border p-1 text-right ${
                    r.type === "debit"
                      ? "text-red-600"
                      : r.type === "credit"
                      ? "text-green-600"
                      : ""
                  }`}
                >
                  {money(r.amount)}
                </td>

                <td className="border p-1 text-right">{money(r.balance)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="border p-3 text-center text-gray-500" colSpan={6}>
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}