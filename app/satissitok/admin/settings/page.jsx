//app/satissitok/admin/settings/page.jsx
"use client";

import { useEffect, useState } from "react";
import {
  getSettings,
  saveSettings,
} from "@/app/satissitok/services/settingsService";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [vatRates, setVatRates] = useState([]);
  const [incomeRates, setIncomeRates] = useState([]);

  useEffect(() => {
    const load = async () => {
      const s = await getSettings();
      setUnits(s.units || []);
      setVatRates(s.taxes?.vat || []);
      setIncomeRates(s.taxes?.income || []);
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    await saveSettings({
      units,
      taxes: {
        vat: vatRates,
        income: incomeRates,
      },
    });
    alert("Ayarlar kaydedildi");
  };

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-bold">Satış & Stok Ayarları</h1>

      {/* BİRİMLER */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Ürün Birimleri</h2>

        {units.map((u, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              className="border px-2 py-1 w-32"
              placeholder="key"
              value={u.key}
              onChange={(e) => {
                const x = [...units];
                x[i].key = e.target.value;
                setUnits(x);
              }}
            />
            <input
              className="border px-2 py-1"
              placeholder="Etiket"
              value={u.label}
              onChange={(e) => {
                const x = [...units];
                x[i].label = e.target.value;
                setUnits(x);
              }}
            />
            <label className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={u.active}
                onChange={(e) => {
                  const x = [...units];
                  x[i].active = e.target.checked;
                  setUnits(x);
                }}
              />
              Aktif
            </label>
          </div>
        ))}

        <button
          onClick={() =>
            setUnits([...units, { key: "", label: "", active: true }])
          }
          className="text-blue-600 text-sm"
        >
          + Birim ekle
        </button>
      </section>

      {/* KDV */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">KDV Oranları</h2>

        {vatRates.map((v, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              className="border px-2 py-1"
              placeholder="Etiket"
              value={v.label}
              onChange={(e) => {
                const x = [...vatRates];
                x[i].label = e.target.value;
                setVatRates(x);
              }}
            />
            <input
              type="number"
              className="border px-2 py-1 w-24"
              placeholder="%"
              value={v.rate}
              onChange={(e) => {
                const x = [...vatRates];
                x[i].rate = Number(e.target.value);
                setVatRates(x);
              }}
            />
            <label className="text-sm flex items-center gap-1">
              <input
                type="radio"
                name="defaultVat"
                checked={v.default === true}
                onChange={() => {
                  const x = vatRates.map((r, idx) => ({
                    ...r,
                    default: idx === i,
                  }));
                  setVatRates(x);
                }}
              />
              Varsayılan
            </label>
          </div>
        ))}

        <button
          onClick={() =>
            setVatRates([...vatRates, { label: "", rate: 0 }])
          }
          className="text-blue-600 text-sm"
        >
          + KDV ekle
        </button>
      </section>

      {/* GELİR VERGİSİ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Gelir Vergisi Oranları</h2>

        {incomeRates.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="border px-2 py-1"
              placeholder="Etiket"
              value={r.label}
              onChange={(e) => {
                const x = [...incomeRates];
                x[i].label = e.target.value;
                setIncomeRates(x);
              }}
            />
            <input
              type="number"
              className="border px-2 py-1 w-24"
              placeholder="%"
              value={r.rate}
              onChange={(e) => {
                const x = [...incomeRates];
                x[i].rate = Number(e.target.value);
                setIncomeRates(x);
              }}
            />
          </div>
        ))}

        <button
          onClick={() =>
            setIncomeRates([...incomeRates, { label: "", rate: 0 }])
          }
          className="text-blue-600 text-sm"
        >
          + Gelir vergisi ekle
        </button>
      </section>

      <div className="text-right">
        <button
          onClick={save}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}
