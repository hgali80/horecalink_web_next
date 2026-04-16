"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Clock3, Home, Percent, Receipt, Users } from "lucide-react";

export default function ReportsIndexPage() {
  const router = useRouter();

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
        <div className="mt-1 text-sm text-gray-600">
          P&L, KDV, satis ozetleri, cari hareketleri ve yaslandirma raporlari
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <Card title="Kar/Zarar (Net)" desc="Gun/Hafta/Ay/Yil net kar" href="/satissitok/admin/reports/pl" icon={<BarChart3 />} />
        <Card title="KDV Raporu" desc="KDV cikis/giris" href="/satissitok/admin/reports/vat" icon={<Percent />} />
        <Card title="Satis Ozeti" desc="Satis toplamlari" href="/satissitok/admin/reports/sales-summary" icon={<Receipt />} />
        <Card title="Cari Raporu" desc="Cari hareketleri" href="/satissitok/admin/reports/cari" icon={<Users />} />
        <Card title="Cari Yaslandirma" desc="Acik belge vade dagilimi" href="/satissitok/admin/reports/cari-aging" icon={<Clock3 />} />
      </div>
    </div>
  );
}

function Card({ title, desc, href, icon }) {
  return (
    <Link href={href} className="block rounded-xl border bg-white p-4 transition hover:shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-gray-900">
        <span className="text-gray-700">{icon}</span>
        {title}
      </div>
      <div className="mt-2 text-sm text-gray-600">{desc}</div>
    </Link>
  );
}
