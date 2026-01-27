//app/satissitok/admin/sales/new/components/SaleForm.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import SaleItemsTable from "./SaleItemsTable";

export default function SaleForm({
  products,
  units,
  caris,
  settings, // { defaultVatRate }
  onSubmit,
}) {
  // -----------------------------
  // STATE
  // -----------------------------
  const [saleType, setSaleType] = useState("official"); // official | actual
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [cariId, setCariId] = useState("");

  const [vatMode, setVatMode] = useState("exclude"); // include | exclude
  const [vatRate, setVatRate] = useState(
    Number(settings?.defaultVatRate || 0)
  );

  const [items, setItems] = useState([]);

  const [submitting, setSubmitting] = useState(false);

  // -----------------------------
  // SALE TYPE CHANGE EFFECT
  // -----------------------------
  useEffect(() => {
    if (saleType === "actual") {
      // fiili satışta KDV yok
      setVatMode("exclude");
      setVatRate(0);
    } else {
      // resmi satış
      setVatRate(Number(settings?.defaultVatRate || 0));
    }
  }, [saleType, settings]);

  // -----------------------------
  // FOOTER TOTALS (SADECE TOPLAMA)
  // -----------------------------
  const totals = useMemo(() => {
    let net = 0;
    let vat = 0;
    let total = 0;
    let qty = 0;

    items.forEach((r) => {
      net += Number(r.net || 0);
      vat += Number(r.vat || 0);
      total += Number(r.total || 0);
      qty += Number(r.quantity || 0);
    });

    return {
      net,
      vat,
      total,
      qty,
    };
  }, [items]);

  // -----------------------------
  // VALIDATION
  // -----------------------------
  const hasInvalidRow = items.some(
    (r) => !r.productId || !r.quantity
  );

  const canSubmit =
    !submitting &&
    items.length > 0 &&
    !hasInvalidRow &&
    !!cariId;

  // -----------------------------
  // SUBMIT
  // -----------------------------
  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await onSubmit({
        saleType,
        docNo,
        docDate,
        cariId,
        vatMode,
        vatRate,
        items,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="space-y-6">
      {/* ========================= */}
      {/* ÜST BİLGİLER */}
      {/* ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded">
        {/* Satış Türü */}
        <div>
          <label className="block text-sm font-medium">
            Satış Türü
          </label>
          <select
            className="w-full border p-2"
            value={saleType}
            onChange={(e) => setSaleType(e.target.value)}
          >
            <option value="official">Resmi</option>
            <option value="actual">Fiili</option>
          </select>
        </div>

        {/* Belge No */}
        <div>
          <label className="block text-sm font-medium">
            Belge No
          </label>
          <input
            type="text"
            className="w-full border p-2"
            value={docNo}
            onChange={(e) => setDocNo(e.target.value)}
          />
        </div>

        {/* Belge Tarihi */}
        <div>
          <label className="block text-sm font-medium">
            Belge Tarihi
          </label>
          <input
            type="date"
            className="w-full border p-2"
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
          />
        </div>

        {/* Cari */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">
            Cari <span className="text-red-600">*</span>
          </label>
          <select
            className="w-full border p-2"
            value={cariId}
            onChange={(e) => setCariId(e.target.value)}
          >
            <option value="">Cari seçiniz</option>
            {caris.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firm}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================= */}
      {/* KDV BLOĞU (SADECE RESMİ) */}
      {/* ========================= */}
      {saleType === "official" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded">
          {/* KDV Tipi */}
          <div>
            <label className="block text-sm font-medium">
              KDV Tipi
            </label>
            <select
              className="w-full border p-2"
              value={vatMode}
              onChange={(e) => setVatMode(e.target.value)}
            >
              <option value="exclude">Hariç</option>
              <option value="include">Dahil</option>
            </select>
          </div>

          {/* KDV Oranı */}
          <div>
            <label className="block text-sm font-medium">
              KDV Oranı (%)
            </label>
            <input
              type="number"
              className="w-full border p-2 bg-gray-100"
              value={vatRate}
              readOnly
            />
          </div>
        </div>
      )}

      {/* ========================= */}
      {/* KALEMLER */}
      {/* ========================= */}
      <SaleItemsTable
        items={items}
        setItems={setItems}
        products={products}
        units={units}
        vatRate={vatRate}
        vatMode={vatMode}
        saleType={saleType}
      />

      {/* Satır ekle */}
      <div>
        <button
          type="button"
          className="px-3 py-1 border rounded"
          onClick={() =>
            setItems((prev) => [
              ...prev,
              {
                productId: "",
                quantity: "",
                unit: "",
                unitPrice: "",
                discountType: "none",
                discountValue: 0,
                net: 0,
                vat: 0,
                total: 0,
              },
            ])
          }
        >
          + Satır Ekle
        </button>
      </div>

      {/* ========================= */}
      {/* FOOTER */}
      {/* ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border p-4 rounded">
        <FooterItem label="Net Toplam" value={totals.net} />
        <FooterItem label="KDV Toplam" value={totals.vat} />
        <FooterItem label="Genel Toplam" value={totals.total} />
        <FooterItem label="Toplam Adet" value={totals.qty} />
      </div>

      {/* ========================= */}
      {/* AKSİYON */}
      {/* ========================= */}
      <div className="flex gap-2">
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`px-4 py-2 rounded text-white ${
            canSubmit
              ? "bg-black"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {submitting ? "Kaydediliyor..." : "Satışı Kaydet"}
        </button>
      </div>
    </div>
  );
}

function FooterItem({ label, value }) {
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="font-semibold">
        {Number(value || 0).toFixed(2)}
      </div>
    </div>
  );
}
