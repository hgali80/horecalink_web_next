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
  }, [cariId]);

  async function loadData() {
    setLoading(true);

    // Cari kart
    const cariSnap = await getDoc(doc(db, "caris", cariId));
    if (cariSnap.exists()) {
      setCari(cariSnap.data());
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

    snap.forEach((doc) => {
      const t = doc.data();
      const amt = Number(t.amount || 0);

      if (t.type === "debit") balance += amt;
      if (t.type === "credit") balance -= amt;

      table.push({
        date: t.createdAt,
        type: t.type,
        source: t.source,
        refId: t.refId,
        amount: amt,
        balance,
      });
    });

    setRows(table);
    setLoading(false);
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">
        Cari Detayı
      </h1>

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
              <tr key={i}>
                <td className="border p-1">
                  {formatDate(r.date)}
                </td>
                <td className="border p-1">
                  {r.type === "debit"
                    ? "Borç"
                    : "Alacak"}
                </td>
                <td className="border p-1">
                  {r.source}
                </td>
                <td className="border p-1">
                  {r.refId || "-"}
                </td>
                <td
                  className={`border p-1 text-right ${
                    r.type === "debit"
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {money(r.amount)}
                </td>
                <td className="border p-1 text-right">
                  {money(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
