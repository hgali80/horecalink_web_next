// app/satissitok/admin/cari/new/page.jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { createCari } from "../services/cariService";

export default function NewCariPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    type: "supplier",
    firm: "",
    legalAddress: "",
    bin: "",
    iban: "",
    bank: "",
    bic: "",
    kbe: "",
    mobile: "",
    director: "",
  });

  const submit = async () => {
    if (!form.firm) {
      alert("Firma adı zorunludur");
      return;
    }

    await createCari(form);
    alert("Cari kart oluşturuldu");
    router.push("/satissitok/admin/cari");
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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

      <h1 className="text-2xl font-bold">Yeni Cari Kart</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          className="border px-3 py-2"
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
        >
          <option value="supplier">Tedarikçi</option>
          <option value="customer">Müşteri</option>
          <option value="both">Her İkisi</option>
        </select>

        <input
          className="border px-3 py-2"
          placeholder="Фирма"
          value={form.firm}
          onChange={(e) => set("firm", e.target.value)}
        />

        <input
          className="border px-3 py-2 md:col-span-2"
          placeholder="Юридический адрес"
          value={form.legalAddress}
          onChange={(e) => set("legalAddress", e.target.value)}
        />

        <input
          className="border px-3 py-2"
          placeholder="БИН"
          value={form.bin}
          onChange={(e) => set("bin", e.target.value)}
        />

        <input
          className="border px-3 py-2"
          placeholder="ИИК (IBAN)"
          value={form.iban}
          onChange={(e) => set("iban", e.target.value)}
        />

        <input
          className="border px-3 py-2"
          placeholder="Банк"
          value={form.bank}
          onChange={(e) => set("bank", e.target.value)}
        />

        <input
          className="border px-3 py-2"
          placeholder="БИК"
          value={form.bic}
          onChange={(e) => set("bic", e.target.value)}
        />

        <input
          className="border px-3 py-2"
          placeholder="Кбе"
          value={form.kbe}
          onChange={(e) => set("kbe", e.target.value)}
        />

        <input
          className="border px-3 py-2"
          placeholder="Моб."
          value={form.mobile}
          onChange={(e) => set("mobile", e.target.value)}
        />

        <input
          className="border px-3 py-2"
          placeholder="Директор"
          value={form.director}
          onChange={(e) => set("director", e.target.value)}
        />
      </div>

      <div className="text-right">
        <button
          onClick={submit}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}