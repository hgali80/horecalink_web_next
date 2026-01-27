// app/satissitok/admin/settings/page.jsx
"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/app/satissitok/services/settingsService";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [vatRates, setVatRates] = useState([]);
  const [incomeRates, setIncomeRates] = useState([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const s = await getSettings();
        if (!alive) return;

        setUnits(Array.isArray(s.units) ? s.units : []);
        setPlatforms(Array.isArray(s.platforms) ? s.platforms : []);
        setVatRates(Array.isArray(s.taxes?.vat) ? s.taxes.vat : []);
        setIncomeRates(Array.isArray(s.taxes?.income) ? s.taxes.income : []);
      } catch (err) {
        console.error("SETTINGS PAGE LOAD ERROR:", err);
        alert("Ayarlar yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => (alive = false);
  }, []);

  const save = async () => {
    try {
      await saveSettings({
        units,
        platforms,
        taxes: { vat: vatRates, income: incomeRates },
      });
      alert("Ayarlar kaydedildi");
    } catch (err) {
      console.error("SETTINGS SAVE ERROR:", err);
      alert("Ayarlar kaydedilirken hata oluştu");
    }
  };

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-bold">Satış & Stok Ayarları</h1>

      {/* ===================== */}
      {/* SATIŞ PLATFORMLARI */}
      {/* ===================== */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Satış Platformları</h2>

        {platforms.map((p, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center">
            <input
              className="border px-2 py-1 w-36"
              placeholder="key (kaspi)"
              value={p.key || ""}
              onChange={(e) => {
                const x = [...platforms];
                x[i] = { ...x[i], key: e.target.value };
                setPlatforms(x);
              }}
            />
            <input
              className="border px-2 py-1"
              placeholder="Etiket"
              value={p.label || ""}
              onChange={(e) => {
                const x = [...platforms];
                x[i] = { ...x[i], label: e.target.value };
                setPlatforms(x);
              }}
            />
            <label className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={p.active !== false}
                onChange={(e) => {
                  const x = [...platforms];
                  x[i] = { ...x[i], active: e.target.checked };
                  setPlatforms(x);
                }}
              />
              Aktif
            </label>

            <label className="text-sm flex items-center gap-1">
              <input
                type="radio"
                name="defaultPlatform"
                checked={p.default === true}
                onChange={() => {
                  const x = platforms.map((r, idx) => ({ ...r, default: idx === i }));
                  setPlatforms(x);
                }}
              />
              Varsayılan
            </label>
          </div>
        ))}

        <button
          onClick={() => setPlatforms([...platforms, { key: "", label: "", active: true }])}
          className="text-blue-600 text-sm"
        >
          + Platform ekle
        </button>
      </section>

      {/* ===================== */}
      {/* ÜRÜN BİRİMLERİ */}
      {/* ===================== */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Ürün Birimleri</h2>

        {units.map((u, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center">
            <input
              className="border px-2 py-1 w-36"
              placeholder="key"
              value={u.key || ""}
              onChange={(e) => {
                const x = [...units];
                x[i] = { ...x[i], key: e.target.value };
                setUnits(x);
              }}
            />
            <input
              className="border px-2 py-1"
              placeholder="Etiket"
              value={u.label || ""}
              onChange={(e) => {
                const x = [...units];
                x[i] = { ...x[i], label: e.target.value };
                setUnits(x);
              }}
            />
            <label className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={u.active !== false}
                onChange={(e) => {
                  const x = [...units];
                  x[i] = { ...x[i], active: e.target.checked };
                  setUnits(x);
                }}
              />
              Aktif
            </label>

            <label className="text-sm flex items-center gap-1">
              <input
                type="radio"
                name="defaultUnit"
                checked={u.default === true}
                onChange={() => {
                  const x = units.map((r, idx) => ({ ...r, default: idx === i }));
                  setUnits(x);
                }}
              />
              Varsayılan
            </label>
          </div>
        ))}

        <button
          onClick={() => setUnits([...units, { key: "", label: "", active: true }])}
          className="text-blue-600 text-sm"
        >
          + Birim ekle
        </button>
      </section>

      {/* ===================== */}
      {/* KDV ORANLARI */}
      {/* ===================== */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">KDV Oranları</h2>

        {vatRates.map((v, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center">
            <input
              className="border px-2 py-1"
              placeholder="Etiket"
              value={v.label || ""}
              onChange={(e) => {
                const x = [...vatRates];
                x[i] = { ...x[i], label: e.target.value };
                setVatRates(x);
              }}
            />
            <input
              type="number"
              className="border px-2 py-1 w-24"
              placeholder="%"
              value={v.rate ?? 0}
              onChange={(e) => {
                const x = [...vatRates];
                x[i] = { ...x[i], rate: Number(e.target.value) };
                setVatRates(x);
              }}
            />
            <label className="text-sm flex items-center gap-1">
              <input
                type="radio"
                name="defaultVat"
                checked={v.default === true}
                onChange={() => {
                  const x = vatRates.map((r, idx) => ({ ...r, default: idx === i }));
                  setVatRates(x);
                }}
              />
              Varsayılan
            </label>
          </div>
        ))}

        <button
          onClick={() => setVatRates([...vatRates, { label: "", rate: 0, active: true }])}
          className="text-blue-600 text-sm"
        >
          + KDV ekle
        </button>
      </section>

      {/* ===================== */}
      {/* GELİR VERGİSİ */}
      {/* ===================== */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Gelir Vergisi Oranları</h2>

        {incomeRates.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              className="border px-2 py-1"
              placeholder="Etiket"
              value={r.label || ""}
              onChange={(e) => {
                const x = [...incomeRates];
                x[i] = { ...x[i], label: e.target.value };
                setIncomeRates(x);
              }}
            />
            <input
              type="number"
              className="border px-2 py-1 w-24"
              placeholder="%"
              value={r.rate ?? 0}
              onChange={(e) => {
                const x = [...incomeRates];
                x[i] = { ...x[i], rate: Number(e.target.value) };
                setIncomeRates(x);
              }}
            />
          </div>
        ))}

        <button
          onClick={() => setIncomeRates([...incomeRates, { label: "", rate: 0, active: true }])}
          className="text-blue-600 text-sm"
        >
          + Gelir vergisi ekle
        </button>
      </section>

      <div className="text-right">
        <button onClick={save} className="px-4 py-2 bg-green-600 text-white rounded">
          Kaydet
        </button>
      </div>
    </div>
  );
}
