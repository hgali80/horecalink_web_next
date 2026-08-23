"use client";

import Link from "next/link";
import {
  Boxes,
  Package,
  ShieldCheck,
  FileText,
  FileSpreadsheet,
  Mail,
  LayoutTemplate,
  Images,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import VisitorAnalyticsCard from "../../components/VisitorAnalyticsCard";

export default function SalesStockDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Yukleniyor...</div>
      </div>
    );
  }

  const isSuperAdmin = user?.role === "super_admin";
  const canUseImport = user?.role === "super_admin" || user?.role === "admin";

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Yonetim Paneli</h1>

        {user ? (
          <div className="text-sm text-slate-600">
            Aktif kullanici: <span className="font-semibold">{user.fullName || user.email || "Yetkili Kullanici"}</span> · Rol: <span className="font-semibold">{user.role || "tanimsiz"}</span>
          </div>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Yonetim</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6">
          <VisitorAnalyticsCard />

          <DashboardCard
            title="ERP Modulu"
            desc="Yeni satis, satinalma, stok, cari, finans ve rapor yapisina tek yerden gir"
            href="/satissitok/admin/erp"
            color="green"
            icon={<Boxes />}
          />

          <DashboardCard
            title="Teklifler"
            desc="Gelen teklif taleplerini goruntule ve yonet"
            href="/satissitok/admin/quotes"
            color="orange"
            icon={<FileText />}
          />

          <DashboardCard
            title="Teklif Olustur"
            desc="Admin tarafinda yeni ticari teklif hazirla"
            href="/satissitok/admin/commercial-offers"
            color="blue"
            icon={<FileText />}
          />

          <DashboardCard
            title="Urun Listeleri"
            desc="Musteriye ozel, fotografli ve sade urun listeleri hazirla"
            href="/satissitok/admin/product-presentations"
            color="purple"
            icon={<Images />}
          />

          <DashboardCard
            title="Mesajlar"
            desc="Iletisim formundan gelen mesajlari oku"
            href="/satissitok/admin/contact-messages"
            color="blue"
            icon={<Mail />}
          />

          <DashboardCard
            title="Urunler"
            desc="Urun listesi, yeni urun olustur, duzenle"
            href="/satissitok/admin/products"
            color="purple"
            icon={<Package />}
          />

          <DashboardCard
            title="Kullanim Alanlari"
            desc="Alan olustur, gorsel ekle, urunleri ata"
            href="/satissitok/admin/usage-areas"
            color="orange"
            icon={<LayoutTemplate />}
          />

          {canUseImport ? (
            <DashboardCard
              title="Excel Import"
              desc="Excel dosyasindan products koleksiyonunu toplu senkronize et"
              href="/satissitok/admin/import"
              color="blue"
              icon={<FileSpreadsheet />}
            />
          ) : null}

          {isSuperAdmin ? (
            <DashboardCard
              title="Yetkili Yonetimi"
              desc="Yeni yetkili ekle ve ic kullanicilari yonet"
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
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">{icon}</div>
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-gray-600">{desc}</div>
    </Link>
  );
}
