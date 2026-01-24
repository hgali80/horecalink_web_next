//app/satissitok/admin/purchases/new/components/PurchaseForm.jsx
"use client";

import { useEffect, useState } from "react";
import PurchaseItemsTable from "./PurchaseItemsTable";
import { getSettings } from "@/app/satissitok/services/settingsService";

export default function PurchaseForm({ onSubmit }) {
  const [purchaseType, setPurchaseType] = useState("official");

  const [supplierName, setSupplierName] = useState("");
  const [documentNo, setDocumentNo] = useState("");
  const [documentDate, setDocumentDate] = useState("");

  const [items, setItems] = useState([]);

  // AYARLARDAN GELENLER
  const [vatRates, setVatRates] = useState([]);
  const [selectedVat, setSelectedVat] = useState(0);

  // Ayarları yükle
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      const vats = settings?.taxes?.vat || [];
      setVatRates(vats);

      const def = vats.find((v) => v.default === true);
      setSelectedVat(def ? def.rate : 0);
    };
    loadSettings();
  }, []);

  // Fiili seçilince KDV sıfırlansın
  useEffect(() => {
    if (purchaseType === "actual") {
      setSelectedVat(0);
    }
  }, [purchaseType]);

  // Toplamlar
  const netTotal = items.reduce(
    (sum, item) => sum + (item.lineTotal || 0),
    0
  );

  const taxTotal =
    purchaseType === "official"
      ? (netTotal * Number(selectedVat || 0)) / 100
      : 0;

  const grossTotal = netTotal + taxTotal;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!supplierName || !documentDate || items.length === 0) {
      alert("Lütfen gerekli alanları doldurun.");
      return;
    }

    const payload = {
      supplierName,
      documentNo,
      documentDate,
      purchaseType,
      taxRate: purchaseType === "official" ? selectedVat : 0,
      items,
      totals: {
        net: netTotal,
        tax: taxTotal,
        gross: grossTotal,
      },
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ÜST BİLGİLER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Satınalma Türü */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Satınalma Türü
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={purchaseType === "official"}
                onChange={() => setPurchaseType("official")}
              />
              Resmi
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={purchaseType === "actual"}
                onChange={() => setPurchaseType("actual")}
              />
              Fiili
            </label>
          </div>
        </div>

        {/* Tedarikçi */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Tedarikçi
          </label>
          <input
            type="text"
            className="w-full border rounded px-2 py-1"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
        </div>

        {/* Belge No */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Belge No
          </label>
          <input
            type="text"
            className="w-full border rounded px-2 py-1"
            value={documentNo}
            onChange={(e) => setDocumentNo(e.target.value)}
          />
        </div>

        {/* Belge Tarihi */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Belge Tarihi
          </label>
          <input
            type="date"
            className="w-full border rounded px-2 py-1"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
          />
        </div>

        {/* KDV ORANI (AYARLARDAN) */}
        {purchaseType === "official" && (
          <div>
            <label className="block text-sm font-medium mb-1">
              KDV Oranı
            </label>
            <select
              className="w-full border rounded px-2 py-1"
              value={selectedVat}
              onChange={(e) => setSelectedVat(Number(e.target.value))}
            >
              {vatRates.map((v, i) => (
                <option key={i} value={v.rate}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ÜRÜN KALEMLERİ */}
      <PurchaseItemsTable onChange={setItems} />

      {/* TOPLAMLAR */}
      <div className="border-t pt-4 space-y-2 text-right">
        <div>
          Net Toplam: <strong>{netTotal.toLocaleString()} ₸</strong>
        </div>
        <div>
          KDV: <strong>{taxTotal.toLocaleString()} ₸</strong>
        </div>
        <div className="text-lg">
          Genel Toplam:{" "}
          <strong>{grossTotal.toLocaleString()} ₸</strong>
        </div>
      </div>

      {/* KAYDET */}
      <div className="text-right">
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Satınalma Kaydet
        </button>
      </div>
    </form>
  );
}
