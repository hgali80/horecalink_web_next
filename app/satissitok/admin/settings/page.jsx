// app/satissitok/admin/settings/page.jsx
"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/app/satissitok/services/settingsService";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
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
        setWarehouses(Array.isArray(s.warehouses) ? s.warehouses : []);
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
        warehouses,
        platforms,
        taxes: { vat: vatRates, income: incomeRates },
      });
      alert("Ayarlar başarıyla kaydedildi.");
    } catch (err) {
      console.error("SETTINGS SAVE ERROR:", err);
      alert("Ayarlar kaydedilirken hata oluştu");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  const inputClass = "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2";
  const sectionClass = "bg-white shadow sm:rounded-lg border border-gray-100 overflow-hidden";
  const headerClass = "px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50/50";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sistem Ayarları</h1>
            <p className="mt-2 text-sm text-gray-500">Satış platformları, birimler ve vergi oranlarını buradan yönetebilirsiniz.</p>
          </div>
          <button 
            onClick={save} 
            className="mt-4 md:mt-0 inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Değişiklikleri Kaydet
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8">
          
          {/* SATIŞ PLATFORMLARI */}
          <section className={sectionClass}>
            <div className={headerClass}>
              <h2 className="text-lg font-bold leading-6 text-gray-900">Satış Platformları</h2>
            </div>
            <div className="p-6 space-y-4">
              {platforms.map((p, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <input
                    className={inputClass}
                    placeholder="Anahtar (örn: kaspi)"
                    value={p.key || ""}
                    onChange={(e) => {
                      const x = [...platforms];
                      x[i] = { ...x[i], key: e.target.value };
                      setPlatforms(x);
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Görünen Etiket"
                    value={p.label || ""}
                    onChange={(e) => {
                      const x = [...platforms];
                      x[i] = { ...x[i], label: e.target.value };
                      setPlatforms(x);
                    }}
                  />
                  <div className="flex items-center space-x-6 px-2">
                    <label className="relative inline-flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        checked={p.active !== false}
                        onChange={(e) => {
                          const x = [...platforms];
                          x[i] = { ...x[i], active: e.target.checked };
                          setPlatforms(x);
                        }}
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Aktif</span>
                    </label>

                    <label className="relative inline-flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        name="defaultPlatform"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        checked={p.default === true}
                        onChange={() => {
                          const x = platforms.map((r, idx) => ({ ...r, default: idx === i }));
                          setPlatforms(x);
                        }}
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Varsayılan</span>
                    </label>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setPlatforms([...platforms, { key: "", label: "", active: true }])}
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span className="text-lg mr-1">+</span> Yeni Platform Ekle
              </button>
            </div>
          </section>

          {/* ÜRÜN BİRİMLERİ */}
          <section className={sectionClass}>
            <div className={headerClass}>
              <h2 className="text-lg font-bold leading-6 text-gray-900">Ürün Birimleri</h2>
            </div>
            <div className="p-6 space-y-4">
              {units.map((u, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <input
                    className={inputClass}
                    placeholder="Birim Kodu (örn: adet)"
                    value={u.key || ""}
                    onChange={(e) => {
                      const x = [...units];
                      x[i] = { ...x[i], key: e.target.value };
                      setUnits(x);
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Birim Adı"
                    value={u.label || ""}
                    onChange={(e) => {
                      const x = [...units];
                      x[i] = { ...x[i], label: e.target.value };
                      setUnits(x);
                    }}
                  />
                  <div className="flex items-center space-x-6 px-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        checked={u.active !== false}
                        onChange={(e) => {
                          const x = [...units];
                          x[i] = { ...x[i], active: e.target.checked };
                          setUnits(x);
                        }}
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Aktif</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="defaultUnit"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        checked={u.default === true}
                        onChange={() => {
                          const x = units.map((r, idx) => ({ ...r, default: idx === i }));
                          setUnits(x);
                        }}
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Varsayılan</span>
                    </label>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setUnits([...units, { key: "", label: "", active: true }])}
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span className="text-lg mr-1">+</span> Yeni Birim Ekle
              </button>
            </div>
          </section>

          {/* DEPOLAR */}
          <section className={sectionClass}>
            <div className={headerClass}>
              <h2 className="text-lg font-bold leading-6 text-gray-900">Depolar</h2>
              <p className="mt-1 text-sm text-gray-500">Satış ve satınalma satırlarında depo seçimi için kullanılır.</p>
            </div>
            <div className="p-6 space-y-4">
              {warehouses.map((w, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <input
                    className={inputClass}
                    placeholder="Depo Kodu (örn: main)"
                    value={w.key || ""}
                    onChange={(e) => {
                      const x = [...warehouses];
                      x[i] = { ...x[i], key: e.target.value };
                      setWarehouses(x);
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Depo Adı"
                    value={w.label || ""}
                    onChange={(e) => {
                      const x = [...warehouses];
                      x[i] = { ...x[i], label: e.target.value };
                      setWarehouses(x);
                    }}
                  />
                  <div className="flex items-center space-x-6 px-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        checked={w.active !== false}
                        onChange={(e) => {
                          const x = [...warehouses];
                          x[i] = { ...x[i], active: e.target.checked };
                          setWarehouses(x);
                        }}
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Aktif</span>
                    </label>

                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="defaultWarehouse"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        checked={w.default === true}
                        onChange={() => {
                          const x = warehouses.map((r, idx) => ({ ...r, default: idx === i }));
                          setWarehouses(x);
                        }}
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Varsayılan</span>
                    </label>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setWarehouses([...warehouses, { key: "", label: "", active: true }])}
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span className="text-lg mr-1">+</span> Yeni Depo Ekle
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* KDV ORANLARI */}
            <section className={sectionClass}>
              <div className={headerClass}>
                <h2 className="text-lg font-bold leading-6 text-gray-900">KDV Oranları</h2>
              </div>
              <div className="p-6 space-y-4">
                {vatRates.map((v, i) => (
                  <div key={i} className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <input
                      className={inputClass}
                      placeholder="Etiket"
                      value={v.label || ""}
                      onChange={(e) => {
                        const x = [...vatRates];
                        x[i] = { ...x[i], label: e.target.value };
                        setVatRates(x);
                      }}
                    />
                    <div className="relative w-28">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">%</span>
                      <input
                        type="number"
                        className={`${inputClass} pl-7`}
                        value={v.rate ?? 0}
                        onChange={(e) => {
                          const x = [...vatRates];
                          x[i] = { ...x[i], rate: Number(e.target.value) };
                          setVatRates(x);
                        }}
                      />
                    </div>
                    <label className="flex items-center min-w-fit cursor-pointer">
                      <input
                        type="radio"
                        name="defaultVat"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        checked={v.default === true}
                        onChange={() => {
                          const x = vatRates.map((r, idx) => ({ ...r, default: idx === i }));
                          setVatRates(x);
                        }}
                      />
                    </label>
                  </div>
                ))}
                <button
                  onClick={() => setVatRates([...vatRates, { label: "", rate: 0, active: true }])}
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <span className="text-lg mr-1">+</span> KDV Ekle
                </button>
              </div>
            </section>

            {/* GELİR VERGİSİ */}
            <section className={sectionClass}>
              <div className={headerClass}>
                <h2 className="text-lg font-bold leading-6 text-gray-900">Gelir Vergisi Oranları</h2>
              </div>
              <div className="p-6 space-y-4">
                {incomeRates.map((r, i) => (
                  <div key={i} className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <input
                      className={inputClass}
                      placeholder="Vergi Türü"
                      value={r.label || ""}
                      onChange={(e) => {
                        const x = [...incomeRates];
                        x[i] = { ...x[i], label: e.target.value };
                        setIncomeRates(x);
                      }}
                    />
                    <div className="relative w-32">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">%</span>
                      <input
                        type="number"
                        className={`${inputClass} pl-7`}
                        value={r.rate ?? 0}
                        onChange={(e) => {
                          const x = [...incomeRates];
                          x[i] = { ...x[i], rate: Number(e.target.value) };
                          setIncomeRates(x);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setIncomeRates([...incomeRates, { label: "", rate: 0, active: true }])}
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <span className="text-lg mr-1">+</span> Vergi Oranı Ekle
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-200">
          <button 
            onClick={save} 
            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 active:transform active:scale-95 transition-all"
          >
            Tüm Ayarları Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}