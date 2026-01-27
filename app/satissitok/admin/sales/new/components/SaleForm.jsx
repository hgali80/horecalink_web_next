// app/satissitok/admin/sales/new/components/SaleForm.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import SaleItemsTable from "./SaleItemsTable";

export default function SaleForm({ products, caris, settings, onSubmit }) {
  const [saleType, setSaleType] = useState("official"); // official|actual
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));

  const [platformId, setPlatformId] = useState("");
  const [cariId, setCariId] = useState("");

  const [vatMode, setVatMode] = useState("exclude"); // exclude|include (fatura bazlı)
  const [vatRate, setVatRate] = useState(0);

  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // defaults
  useEffect(() => {
    const defaultPlatform =
      settings?.platforms?.find((x) => x.default === true && x.active !== false) ||
      settings?.platforms?.find((x) => x.active !== false);

    if (!platformId && defaultPlatform?.key) setPlatformId(defaultPlatform.key);

    const defaultVat =
      settings?.taxes?.vat?.find((x) => x.default === true && x.active !== false) ||
      settings?.taxes?.vat?.find((x) => x.active !== false);

    if (saleType === "official") {
      setVatRate(Number(defaultVat?.rate ?? 0));
    } else {
      // fiili satışta vergi yok (senin modeline uygun)
      setVatMode("exclude");
      setVatRate(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, saleType]);

  // Totals: sadece toplama
  const totals = useMemo(() => {
    let net = 0,
      vat = 0,
      total = 0;

    for (const r of items) {
      net += Number(r.net || 0);
      vat += Number(r.vat || 0);
      total += Number(r.total || 0);
    }

    return { net, vat, total };
  }, [items]);

  const canSubmit =
    !submitting &&
    platformId &&
    cariId &&
    items.length > 0 &&
    items.every((r) => r.productId && Number(r.quantity) > 0);

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await onSubmit({
        saleType,
        invoiceDate,
        platformId,
        cariId,
        vatMode,
        vatRate,
        items,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİLER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded">
        <div>
          <label>Satış Türü</label>
          <select className="w-full border p-2" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
            <option value="official">Resmi</option>
            <option value="actual">Fiili</option>
          </select>
        </div>

        <div>
          <label>Fatura No</label>
          <input className="w-full border p-2 bg-gray-100" value={"Otomatik üretilecek"} readOnly />
        </div>

        <div>
          <label>Fatura Tarihi</label>
          <input
            type="date"
            className="w-full border p-2"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>

        <div>
          <label>
            Satış Platformu <span className="text-red-600">*</span>
          </label>
          <select className="w-full border p-2" value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
            <option value="">Seçiniz</option>
            {(settings?.platforms || [])
              .filter((p) => p.active !== false)
              .map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label>
            Cari / Müşteri <span className="text-red-600">*</span>
          </label>
          <select className="w-full border p-2" value={cariId} onChange={(e) => setCariId(e.target.value)}>
            <option value="">Cari seçiniz</option>
            {caris.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firm}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KDV (FATURA BAZLI) */}
      {saleType === "official" && (
        <div className="grid grid-cols-2 gap-4 border p-4 rounded">
          <div>
            <label>KDV Tipi (Fatura bazlı)</label>
            <select className="w-full border p-2" value={vatMode} onChange={(e) => setVatMode(e.target.value)}>
              <option value="exclude">Hariç</option>
              <option value="include">Dahil</option>
            </select>
          </div>

          <div>
            <label>Varsayılan KDV Oranı (%)</label>
            <input className="w-full border p-2 bg-gray-100" value={vatRate} readOnly />
          </div>
        </div>
      )}

      {/* KALEMLER */}
      <SaleItemsTable
        items={items}
        setItems={setItems}
        products={products}
        vatRate={vatRate}
        vatMode={vatMode}
        saleType={saleType}
      />

      <button
        type="button"
        className="border px-3 py-2 rounded"
        onClick={() =>
          setItems((p) => [
            ...p,
            {
              productId: "",
              productName: "",
              quantity: "",
              unit: "",
              unitPrice: "",
              discountRate: 0,
              net: 0,
              vat: 0,
              total: 0,
            },
          ])
        }
      >
        + Satır Ekle
      </button>

      {/* ALT TOPLAMLAR (SADECE TOPLAMA) */}
      <div className="grid grid-cols-3 gap-4 border p-4 rounded">
        <div>Net: {totals.net.toFixed(2)}</div>
        <div>KDV: {totals.vat.toFixed(2)}</div>
        <div>Genel: {totals.total.toFixed(2)}</div>
      </div>

      <button
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`px-4 py-2 text-white rounded ${canSubmit ? "bg-black" : "bg-gray-400"}`}
      >
        Satışı Kaydet
      </button>
    </div>
  );
}
