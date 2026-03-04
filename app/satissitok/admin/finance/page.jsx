// app/satissitok/admin/finance/page.jsx
"use client";

import Link from "next/link";
import { ArrowLeft, Home, Wallet, Landmark, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FinanceDashboard() {
  const router = useRouter();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
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

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finans</h1>
        <div className="text-sm text-gray-600 mt-1">
          Tahsilat, ödeme ve kasa/banka hareketleri
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          title="Tahsilat"
          desc="Müşteriden tahsilat / avans"
          href="/satissitok/admin/finance/collect"
          icon={<ReceiptText />}
          color="green"
        />
        <Card
          title="Ödeme"
          desc="Tedarikçiye ödeme / avans"
          href="/satissitok/admin/finance/pay"
          icon={<ReceiptText />}
          color="blue"
        />
        <Card
          title="Kasa/Banka Hareketleri"
          desc="cash_transactions listesi"
          href="/satissitok/admin/finance/cash"
          icon={<Wallet />}
          color="purple"
        />
        <Card
          title="Hesaplar"
          desc="Nakit, Kaspi, Banka..."
          href="/satissitok/admin/finance/accounts"
          icon={<Landmark />}
          color="orange"
        />
      </div>
    </div>
  );
}

function Card({ title, desc, href, icon, color }) {
  const colors = {
    green: "border-green-300 hover:border-green-500 text-green-700",
    blue: "border-blue-300 hover:border-blue-500 text-blue-700",
    purple: "border-purple-300 hover:border-purple-500 text-purple-700",
    orange: "border-orange-300 hover:border-orange-500 text-orange-700",
  };

  return (
    <Link
      href={href}
      className={`flex flex-col gap-2 p-6 border rounded-xl bg-white shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 ${
        colors[color] || "border-gray-300"
      }`}
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-50">
        {icon}
      </div>

      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-gray-600">{desc}</div>
    </Link>
  );
}
