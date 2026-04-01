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
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function SalesStockDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Satış & Stok Yönetimi
        </h1>

        {user ? (
          <div className="text-sm text-slate-600">
            Aktif kullanıcı:{" "}
            <span className="font-semibold">
              {user.fullName || user.email || "Yetkili Kullanıcı"}
            </span>{" "}
            · Rol:{" "}
            <span className="font-semibold">
              {user.role || "tanımsız"}
            </span>
          </div>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          Hızlı İşlemler
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Yönetim</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6">
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
            title="Teklifler"
            desc="Gelen teklif taleplerini görüntüle ve yönet"
            href="/satissitok/admin/quotes"
            color="orange"
            icon={<FileText />}
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
            title="Ürünler"
            desc="Ürün listesi, yeni ürün oluştur, düzenle"
            href="/satissitok/admin/products"
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

          {isSuperAdmin ? (
            <DashboardCard
              title="Yetkili Yönetimi"
              desc="Yeni yetkili ekle ve iç kullanıcıları yönet"
              href="/satissitok/admin/users"
              color="red"
              icon={<ShieldCheck />}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DashboardCard({ title, desc, href, icon, color }) {
  const colors = {
    green: "border-green-300 hover:border-green-500 text-green-700",
    blue: "border-blue-300 hover:border-blue-500 text-blue-700",
    purple: "border-purple-300 hover:border-purple-500 text-purple-700",
    gray: "border-gray-300 hover:border-gray-500 text-gray-700",
    orange: "border-orange-300 hover:border-orange-500 text-orange-700",
    red: "border-red-300 hover:border-red-500 text-red-700",
  };

  return (
    <Link
      href={href}
      className={`flex transform flex-col gap-2 rounded-xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${colors[color]}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
        {icon}
      </div>

      <div className="text-lg font-semibold">{title}</div>

      <div className="text-sm text-gray-600">{desc}</div>
    </Link>
  );
}
