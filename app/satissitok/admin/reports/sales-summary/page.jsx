// app/satissitok/admin/reports/sales-summary/page.jsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";

function money(n) {
  return Number(n || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SalesSummaryReport() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCount: 0,
    totalGross: 0,
    totalVat: 0,
    officialGross: 0,
    actualGross: 0,
  });

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);

    const q = query(
      collection(db, "sales"),
      where("status", "==", "completed")
    );

    const snap = await getDocs(q);

    let totalCount = 0;
    let totalGross = 0;
    let totalVat = 0;
    let officialGross = 0;
    let actualGross = 0;

    snap.forEach((doc) => {
      const s = doc.data();

      totalCount += 1;
      totalGross += Number(s.grossTotal || 0);
      totalVat += Number(s.vatTotal || 0);

      if (s.saleType === "official") {
        officialGross += Number(s.grossTotal || 0);
      } else {
        actualGross += Number(s.grossTotal || 0);
      }
    });

    setStats({
      totalCount,
      totalGross,
      totalVat,
      officialGross,
      actualGross,
    });

    setLoading(false);
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">
        Satış Özeti
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card
          title="Toplam Satış"
          value={`${stats.totalCount} adet`}
        />
        <Card
          title="Toplam Ciro"
          value={money(stats.totalGross)}
        />
        <Card
          title="Toplam KDV"
          value={money(stats.totalVat)}
        />
        <Card
          title="Resmi Satış"
          value={money(stats.officialGross)}
        />
        <Card
          title="Fiili Satış"
          value={money(stats.actualGross)}
        />
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-gray-500">
        {title}
      </div>
      <div className="text-lg font-semibold">
        {value}
      </div>
    </div>
  );
}
