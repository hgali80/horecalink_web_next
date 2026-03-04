// app/satissitok/admin/page.jsx
"use client";

import Link from "next/link";
import {
  ShoppingCart,
  PlusCircle,
  Package,
  Settings,
  ClipboardList,
  Users,
  Wallet,
  BarChart3,
} from "lucide-react";

export default function SalesStockDashboard() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">
        Satış & Stok Yönetimi
      </h1>

      {/* ================== HIZLI AKSİYONLAR ================== */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Hızlı İşlemler
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DashboardCard
            title="Yeni Satış"
            desc="Yeni satış faturası oluştur"
            href="/satissitok/admin/sales/new"
            color="green"
            icon={<PlusCircle />}
          />

          <DashboardCard
            title="Yeni Satınalma"
            desc="Yeni satınalma faturası gir"
            href="/satissitok/admin/purchases/new"
            color="blue"
            icon={<PlusCircle />}
          />
        </div>
      </section>

      {/* ================== YÖNETİM ================== */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Yönetim
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
          <DashboardCard
            title="Satışlar"
            desc="Satış faturalarını listele"
            href="/satissitok/admin/sales"
            color="green"
            icon={<ShoppingCart />}
          />

          <DashboardCard
            title="Satınalmalar"
            desc="Satınalma kayıtlarını görüntüle"
            href="/satissitok/admin/purchases"
            color="blue"
            icon={<ClipboardList />}
          />

          <DashboardCard
            title="Cariler"
            desc="Müşteri ve tedarikçi kartları"
            href="/satissitok/admin/cari"
            color="orange"
            icon={<Users />}
          />

          <DashboardCard
            title="Stok"
            desc="Stok durumunu ve hareketleri izle"
            href="/satissitok/admin/stock"
            color="purple"
            icon={<Package />}
          />

          <DashboardCard
            title="Ayarlar"
            desc="Birim, vergi ve sistem ayarları"
            href="/satissitok/admin/settings"
            color="gray"
            icon={<Settings />}
          />

          <DashboardCard
            title="Finans"
            desc="Tahsilat, ödeme, kasa/banka"
            href="/satissitok/admin/finance"
            color="purple"
            icon={<Wallet />}
          />

          <DashboardCard
            title="Raporlar"
            desc="Net kâr, KDV, dönem raporları"
            href="/satissitok/admin/reports"
            color="gray"
            icon={<BarChart3 />}
          />
        </div>
      </section>
    </div>
  );
}

/* ================== KART BİLEŞENİ ================== */

function DashboardCard({ title, desc, href, icon, color }) {
  const colors = {
    green: "border-green-300 hover:border-green-500 text-green-700",
    blue: "border-blue-300 hover:border-blue-500 text-blue-700",
    purple: "border-purple-300 hover:border-purple-500 text-purple-700",
    gray: "border-gray-300 hover:border-gray-500 text-gray-700",
    orange: "border-orange-300 hover:border-orange-500 text-orange-700",
  };

  return (
    <Link
      href={href}
      className={`flex flex-col gap-2 p-6 border rounded-xl bg-white shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 ${colors[color]}`}
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-50">
        {icon}
      </div>

      <div className="text-lg font-semibold">
        {title}
      </div>

      <div className="text-sm text-gray-600">
        {desc}
      </div>
    </Link>
  );
}