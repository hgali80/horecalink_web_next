// app/satissitok/admin/reports/page.jsx
"use client";

import Link from "next/link";
import { ArrowLeft, Home, BarChart3, Receipt, Percent, Users } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReportsIndexPage() {
  const router = useRouter();

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
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
        <div className="text-sm text-gray-600 mt-1">P&L, KDV, satış özetleri ve cari raporları</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Kar/Zarar (Net)" desc="Gün/Hafta/Ay/Yıl net kâr" href="/satissitok/admin/reports/pl" icon={<BarChart3 />} />
        <Card title="KDV Raporu" desc="KDV çıkış/giriş" href="/satissitok/admin/reports/vat" icon={<Percent />} />
        <Card title="Satış Özeti" desc="Satış toplamları" href="/satissitok/admin/reports/sales-summary" icon={<Receipt />} />
        <Card title="Cari Raporu" desc="Cari hareketleri" href="/satissitok/admin/reports/cari" icon={<Users />} />
      </div>
    </div>
  );
}

function Card({ title, desc, href, icon }) {
  return (
    <Link
      href={href}
      className="block bg-white border rounded-xl p-4 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-2 text-gray-900 font-semibold">
        <span className="text-gray-700">{icon}</span>
        {title}
      </div>
      <div className="text-sm text-gray-600 mt-2">{desc}</div>
    </Link>
  );
}