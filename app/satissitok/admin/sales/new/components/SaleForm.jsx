//app/satissitok/admin/sales/new/components/SaleForm.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import SaleItemsTable from "./SaleItemsTable";

export default function SaleForm({
  products,
  units,
  caris,
  settings,
  onSubmit,
}) {
  const [saleType, setSaleType] = useState("official");
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [cariId, setCariId] = useState("");
  const [vatMode, setVatMode] = useState("exclude");
  const [vatRate, setVatRate] = useState(0);
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (saleType === "actual") {
      setVatMode("exclude");
      setVatRate(0);
    } else {
      setVatRate(Number(settings?.defaultVatRate || 0));
    }
  }, [saleType, settings]);

  // KDV değişince satırları yeniden hesapla
  useEffect(() => {
    setItems((prev) => [...prev]);
  }, [vatRate, vatMode, saleType]);

  const totals = useMemo(() => {
    let net = 0,
      vat = 0,
      total = 0;

    items.forEach((r) => {
      net += Number(r.net || 0);
      vat += Number(r.vat || 0);
      total += Number(r.total || 0);
    });

    return { net, vat, total };
  }, [items]);

  const canSubmit =
    !submitting &&
    items.length > 0 &&
    items.every((r) => r.productId && r.quantity) &&
    !!cariId;

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded">
        <div>
          <label>Satış Türü</label>
          <select
            className="w-full border p-2"
            value={saleType}
            onChange={(e) => setSaleType(e.target.value)}
          >
            <option value="official">Resmi</option>
            <option value="actual">Fiili</option>
          </select>
        </div>

        <div>
          <label>Fatura No</label>
          <input
            className="w-full border p-2"
            value={docNo}
            onChange={(e) => setDocNo(e.target.value)}
          />
        </div>

        <div>
          <label>Fatura Tarihi</label>
          <input
            type="date"
            className="w-full border p-2"
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label>
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

      {saleType === "official" && (
        <div className="grid grid-cols-2 gap-4 border p-4 rounded">
          <div>
            <label>KDV Tipi</label>
            <select
              className="w-full border p-2"
              value={vatMode}
              onChange={(e) => setVatMode(e.target.value)}
            >
              <option value="exclude">Hariç</option>
              <option value="include">Dahil</option>
            </select>
          </div>

          <div>
            <label>KDV Oranı (%)</label>
            <input
              className="w-full border p-2 bg-gray-100"
              value={vatRate}
              readOnly
            />
          </div>
        </div>
      )}

      <SaleItemsTable
        items={items}
        setItems={setItems}
        products={products}
        units={units}
        vatRate={vatRate}
        vatMode={vatMode}
        saleType={saleType}
      />

      <button
        type="button"
        className="border px-3 py-1"
        onClick={() =>
          setItems((p) => [
            ...p,
            {
              productId: "",
              productName: "",
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

      <div className="grid grid-cols-3 gap-4 border p-4 rounded">
        <div>Net: {totals.net.toFixed(2)}</div>
        <div>KDV: {totals.vat.toFixed(2)}</div>
        <div>Toplam: {totals.total.toFixed(2)}</div>
      </div>

      <button
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`px-4 py-2 text-white ${
          canSubmit ? "bg-black" : "bg-gray-400"
        }`}
      >
        Satışı Kaydet
      </button>
    </div>
  );
}
