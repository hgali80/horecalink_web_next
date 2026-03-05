// app/satissitok/admin/products/new/page.jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Save } from "lucide-react";
import { createProduct } from "@/app/satissitok/services/productService";

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      {children}
    </label>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    stock_code: "",
    name: "",
    name_tr: "",
    barcode: "",
    main_category: "",
    sub_category: "",
    brand: "",
    unit: "шт",
    description: "",
    specs: "",
    price: 0,
    order: 0,
    vatRate: 16,
    productType: "sale_item",
    image_names: "", // virgüllü giriş
    binding_codes: "", // virgüllü giriş
    active: true,
    webPublished: false,
    stockTracked: true,
    saleEnabled: true,
    purchaseEnabled: true,
  });

  function set(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSave() {
    setErr("");
    try {
      setWorking(true);
      const id = await createProduct(form);
      router.push(`/satissitok/admin/products/${id}`);
    } catch (e) {
      setErr(e?.message || "Kaydetme başarısız.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/satissitok/admin/products"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Ürünlere Dön
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <Home className="w-4 h-4" /> Ana Sayfa
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Yeni Ürün</h1>

        <button
          onClick={onSave}
          disabled={working}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900 disabled:opacity-60"
        >
          <Save className="w-4 h-4" /> {working ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Stok Kodu (docId) *">
          <input
            value={form.stock_code}
            onChange={(e) => set("stock_code", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="100000"
          />
        </Field>

        <Field label="Barkod">
          <input
            value={form.barcode}
            onChange={(e) => set("barcode", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="..."
          />
        </Field>

        <Field label="Ürün Adı (RU/KZ) *">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Ürün Adı (TR)">
          <input
            value={form.name_tr}
            onChange={(e) => set("name_tr", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Ana Kategori">
          <input
            value={form.main_category}
            onChange={(e) => set("main_category", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Alt Kategori">
          <input
            value={form.sub_category}
            onChange={(e) => set("sub_category", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Marka">
          <input
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Birim">
          <input
            value={form.unit}
            onChange={(e) => set("unit", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="шт / adet / kg"
          />
        </Field>

        <Field label="Fiyat">
          <input
            type="number"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Sıra (order)">
          <input
            type="number"
            value={form.order}
            onChange={(e) => set("order", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="KDV (vatRate)">
          <input
            type="number"
            value={form.vatRate}
            onChange={(e) => set("vatRate", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Ürün Tipi (productType)">
          <select
            value={form.productType}
            onChange={(e) => set("productType", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="sale_item">sale_item</option>
            <option value="consumable">consumable</option>
            <option value="service">service</option>
          </select>
        </Field>

        <Field label="Görseller (image_names) virgüllü">
          <input
            value={form.image_names}
            onChange={(e) => set("image_names", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="100000,100000-1"
          />
          <div className="text-[11px] text-gray-500">
            Not: Sistem otomatik <b>.jpg</b> ekler.
          </div>
        </Field>

        <Field label="İlgili Ürün Kodları (binding_codes) virgüllü">
          <input
            value={form.binding_codes}
            onChange={(e) => set("binding_codes", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="12,51"
          />
        </Field>
      </div>

      <Field label="Açıklama (description)">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
        />
      </Field>

      <Field label="Teknik (specs)">
        <textarea
          value={form.specs}
          onChange={(e) => set("specs", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-xl p-4">
        {[
          ["active", "Aktif"],
          ["webPublished", "Web’de Yayınla"],
          ["saleEnabled", "Satış Aktif"],
          ["purchaseEnabled", "Satınalma Aktif"],
          ["stockTracked", "Stok Takibi"],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form[k]}
              onChange={(e) => set(k, e.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}