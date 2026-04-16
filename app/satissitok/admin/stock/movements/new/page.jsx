"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { ArrowLeft, Home } from "lucide-react";
import { db } from "@/firebase";
import { getSettings } from "@/app/satissitok/services/settingsService";
import {
  createStockMovement,
  STOCK_MOVEMENT_TYPES,
} from "@/app/satissitok/services/stockMovementService";

function text(value) {
  return String(value || "").trim();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const INITIAL_FORM = {
  movementType: "manual_in",
  productId: "",
  warehouseKey: "main",
  bucketKey: "actual",
  qty: 1,
  targetQty: 0,
  unitCost: 0,
  targetWarehouseKey: "main",
  targetBucketKey: "actual",
  referenceNo: "",
  documentDate: new Date().toISOString().slice(0, 10),
  note: "",
};

export default function NewStockMovementPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const [productsSnap, loadedSettings] = await Promise.all([
        getDocs(query(collection(db, "products"), orderBy("name"))),
        getSettings(),
      ]);

      setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSettings(loadedSettings);
      const defaultWarehouse =
        loadedSettings?.warehouses?.find((item) => item.default)?.key || "main";

      setForm((state) => ({
        ...state,
        warehouseKey: defaultWarehouse,
        targetWarehouseKey: defaultWarehouse,
      }));
    };

    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = text(search).toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      const label = [product.name, product.sku, product.stock_code, product.barcode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return label.includes(q);
    });
  }, [products, search]);

  const selectedProduct = products.find((item) => item.id === form.productId) || null;
  const warehouseOptions = settings?.warehouses || [{ key: "main", label: "Ana Depo" }];
  const bucketOptions = [
    { key: "actual", label: "Fiili" },
    { key: "official", label: "Resmi" },
  ];
  const isTransfer = form.movementType === "transfer";
  const isCount = form.movementType === "count_adjustment";
  const needsUnitCost =
    form.movementType === "manual_in" ||
    form.movementType === "opening_balance" ||
    (form.movementType === "count_adjustment" && num(form.targetQty) > 0);

  function setField(key, value) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await createStockMovement(form);
      alert("Stok hareketi kaydedildi.");
      router.push(
        form.productId
          ? `/satissitok/admin/stock/${form.productId}`
          : "/satissitok/admin/stock"
      );
    } catch (error) {
      console.error("STOCK_MOVEMENT_CREATE_ERROR:", error);
      alert(error?.message || "Stok hareketi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>

        <Link
          href="/satissitok/admin/stock"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          <span className="text-sm font-semibold">Stok</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Yeni Stok Hareketi</h1>
        <p className="text-sm text-gray-500">
          Manuel giris-cikis, transfer, sayim duzeltmesi ve fire islemlerini buradan yonetin.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 rounded-2xl border bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Hareket tipi</span>
            <select
              value={form.movementType}
              onChange={(e) => setField("movementType", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              {STOCK_MOVEMENT_TYPES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Belge / referans</span>
            <input
              value={form.referenceNo}
              onChange={(e) => setField("referenceNo", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="REF-001"
            />
          </label>
        </div>

        <div className="grid gap-3">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Urun ara</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Ad, sku, barkod"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Urun</span>
            <select
              value={form.productId}
              onChange={(e) => setField("productId", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              required
            >
              <option value="">Urun secin</option>
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {[product.name, product.sku || product.stock_code, product.unit]
                    .filter(Boolean)
                    .join(" • ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedProduct && (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <div>
              <strong>Secili urun:</strong> {selectedProduct.name}
            </div>
            <div>
              <strong>Birim:</strong> {selectedProduct.unit || "-"}
            </div>
            <div>
              <strong>Satis fiyati:</strong> {num(selectedProduct.price).toLocaleString("tr-TR")}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Kaynak depo</span>
            <select
              value={form.warehouseKey}
              onChange={(e) => setField("warehouseKey", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              {warehouseOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Kaynak havuz</span>
            <select
              value={form.bucketKey}
              onChange={(e) => setField("bucketKey", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              {bucketOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isTransfer && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-semibold text-gray-700">Hedef depo</span>
              <select
                value={form.targetWarehouseKey}
                onChange={(e) => setField("targetWarehouseKey", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                {warehouseOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold text-gray-700">Hedef havuz</span>
              <select
                value={form.targetBucketKey}
                onChange={(e) => setField("targetBucketKey", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                {bucketOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {!isCount && (
            <label className="space-y-1">
              <span className="text-sm font-semibold text-gray-700">Miktar</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.qty}
                onChange={(e) => setField("qty", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>
          )}

          {isCount && (
            <label className="space-y-1">
              <span className="text-sm font-semibold text-gray-700">Sayim sonucu miktar</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.targetQty}
                onChange={(e) => setField("targetQty", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>
          )}

          <label className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Tarih</span>
            <input
              type="date"
              value={form.documentDate}
              onChange={(e) => setField("documentDate", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>

          {needsUnitCost && (
            <label className="space-y-1">
              <span className="text-sm font-semibold text-gray-700">Birim maliyet</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unitCost}
                onChange={(e) => setField("unitCost", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>
          )}
        </div>

        <label className="space-y-1">
          <span className="text-sm font-semibold text-gray-700">Aciklama</span>
          <textarea
            value={form.note}
            onChange={(e) => setField("note", e.target.value)}
            className="min-h-28 w-full rounded-lg border px-3 py-2"
            placeholder="Islem notu"
          />
        </label>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/satissitok/admin/stock"
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Vazgec
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Stok hareketini kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
