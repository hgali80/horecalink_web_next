"use client";

import { useEffect, useState } from "react";
import ErpSectionHeader from "../_components/ErpSectionHeader";
import ErpCashAccountsSettings from "../_components/ErpCashAccountsSettings";
import { getErpSettings, saveErpSettings } from "../_services/erpSettingsService";

export default function ErpSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    warehouses: [],
    salesPlatforms: [],
    paymentMethods: [],
    numbering: {
      sales: {
        R: { draftPrefix: "", documentPrefix: "", invoicePrefix: "" },
        F: { draftPrefix: "", documentPrefix: "", invoicePrefix: "" },
      },
      purchases: {
        R: { draftPrefix: "", documentPrefix: "", invoicePrefix: "" },
        F: { draftPrefix: "", documentPrefix: "", invoicePrefix: "" },
      },
    },
    taxes: { vat: [] },
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const settings = await getErpSettings();
        if (!alive) return;
        setForm(settings);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "ERP ayarlari yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  function updateChoiceRow(listKey, index, field, value) {
    setForm((current) => {
      const nextRows = [...current[listKey]];
      nextRows[index] = {
        ...nextRows[index],
        [field]: field === "active" || field === "default" ? value === true : value,
      };
      return { ...current, [listKey]: nextRows };
    });
  }

  function updateVatRow(index, field, value) {
    setForm((current) => {
      const nextRows = [...current.taxes.vat];
      nextRows[index] = {
        ...nextRows[index],
        [field]:
          field === "active" || field === "default"
            ? value === true
            : field === "rate" || field === "sortOrder"
              ? Number(value)
              : value,
      };
      return { ...current, taxes: { ...current.taxes, vat: nextRows } };
    });
  }

  function addChoiceRow(listKey, prefix, label) {
    setForm((current) => ({
      ...current,
      [listKey]: [
        ...current[listKey],
        {
          key: `${prefix}_${current[listKey].length + 1}`,
          label,
          active: true,
          default: current[listKey].length === 0,
          sortOrder: current[listKey].length + 1,
        },
      ],
    }));
  }

  function addVatRow() {
    setForm((current) => ({
      ...current,
      taxes: {
        ...current.taxes,
        vat: [
          ...current.taxes.vat,
          {
            key: `vat_${current.taxes.vat.length + 1}`,
            label: "Yeni KDV",
            rate: 0,
            active: true,
            default: current.taxes.vat.length === 0,
            sortOrder: current.taxes.vat.length + 1,
          },
        ],
      },
    }));
  }

  function updateNumbering(kind, docType, key, value) {
    setForm((current) => ({
      ...current,
      numbering: {
        ...current.numbering,
        [kind]: {
          ...current.numbering[kind],
          [docType]: {
            ...current.numbering[kind][docType],
            [key]: value,
          },
        },
      },
    }));
  }

  function removeChoiceRow(listKey, index) {
    setForm((current) => {
      const nextRows = current[listKey].filter((_, rowIndex) => rowIndex !== index);
      return { ...current, [listKey]: nextRows };
    });
  }

  function removeVatRow(index) {
    setForm((current) => ({
      ...current,
      taxes: {
        ...current.taxes,
        vat: current.taxes.vat.filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setNotice("");
      setError("");
      const saved = await saveErpSettings(form);
      setForm(saved);
      setNotice("ERP ayarlari kaydedildi.");
    } catch (err) {
      setError(err?.message || "ERP ayarlari kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        ERP ayarlari yukleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ErpSectionHeader
        eyebrow="ERP / Ayarlar"
        title="ERP Ayarlari"
        description="Depolar, satis platformlari, odeme yontemleri, vergi alanlari ve numaralandirma semalari burada yonetilecek."
      />

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6">
        <ErpCashAccountsSettings />
        <ChoiceSection
          title="Depolar"
          description="ERP icinde kullanilacak depo listesi."
          rows={form.warehouses}
          onChange={updateChoiceRow}
          onAdd={() => addChoiceRow("warehouses", "warehouse", "Yeni Depo")}
          onRemove={removeChoiceRow}
          listKey="warehouses"
        />

        <ChoiceSection
          title="Satis Platformlari"
          description="Satis belgelerinde secilecek platformlar."
          rows={form.salesPlatforms}
          onChange={updateChoiceRow}
          onAdd={() => addChoiceRow("salesPlatforms", "platform", "Yeni Platform")}
          onRemove={removeChoiceRow}
          listKey="salesPlatforms"
        />

        <ChoiceSection
          title="Odeme Yontemleri"
          description="Tahsilat ve odeme ekranlarinda secilecek varsayilan yontemler."
          rows={form.paymentMethods}
          onChange={updateChoiceRow}
          onAdd={() => addChoiceRow("paymentMethods", "payment", "Yeni Odeme Yontemi")}
          onRemove={removeChoiceRow}
          listKey="paymentMethods"
        />

        <VatSection
          rows={form.taxes.vat}
          onChange={updateVatRow}
          onAdd={addVatRow}
          onRemove={removeVatRow}
        />

        <NumberingSection numbering={form.numbering} onChange={updateNumbering} />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Kaydediliyor..." : "ERP Ayarlarini Kaydet"}
        </button>
      </div>
    </div>
  );
}

function NumberingSection({ numbering, onChange }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-900">Numaralandirma Semalari</h2>
        <p className="text-sm leading-6 text-slate-500">
          Draft, belge ve fatura numaralari icin kullanilacak prefixler burada belirlenir.
        </p>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {[
          { kind: "sales", docType: "R", title: "Satis / R" },
          { kind: "sales", docType: "F", title: "Satis / F" },
          { kind: "purchases", docType: "R", title: "Satinalma / R" },
          { kind: "purchases", docType: "F", title: "Satinalma / F" },
        ].map((item) => (
          <div key={`${item.kind}_${item.docType}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 text-sm font-bold text-slate-900">{item.title}</div>
            <div className="grid gap-3">
              <InputField
                label="Draft Prefix"
                value={numbering[item.kind][item.docType].draftPrefix}
                onChange={(value) => onChange(item.kind, item.docType, "draftPrefix", value)}
              />
              <InputField
                label="Belge Prefix"
                value={numbering[item.kind][item.docType].documentPrefix}
                onChange={(value) => onChange(item.kind, item.docType, "documentPrefix", value)}
              />
              <InputField
                label="Fatura Prefix"
                value={numbering[item.kind][item.docType].invoicePrefix}
                onChange={(value) => onChange(item.kind, item.docType, "invoicePrefix", value)}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InputField({ label, value, onChange, type = "text" }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
      />
    </label>
  );
}

function ChoiceSection({ title, description, rows, onChange, onAdd, onRemove, listKey }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Satir Ekle
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row, index) => (
          <div key={`${listKey}_${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1.2fr_1.6fr_0.7fr_0.7fr_0.7fr_auto]">
            <input
              value={row.key}
              onChange={(event) => onChange(listKey, index, "key", event.target.value)}
              placeholder="key"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
            <input
              value={row.label}
              onChange={(event) => onChange(listKey, index, "label", event.target.value)}
              placeholder="label"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
            <input
              type="number"
              value={row.sortOrder}
              onChange={(event) => onChange(listKey, index, "sortOrder", Number(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={row.active === true}
                onChange={(event) => onChange(listKey, index, "active", event.target.checked)}
              />
              Aktif
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={row.default === true}
                onChange={(event) => onChange(listKey, index, "default", event.target.checked)}
              />
              Vars.
            </label>
            <button
              type="button"
              onClick={() => onRemove(listKey, index)}
              className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              Sil
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function VatSection({ rows, onChange, onAdd, onRemove }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">Vergi Oranlari</h2>
          <p className="text-sm leading-6 text-slate-500">
            ERP belgelerinde kullanilacak KDV veya benzeri oranlar.
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Vergi Satiri Ekle
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row, index) => (
          <div key={`vat_${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1.1fr_1.6fr_0.8fr_0.7fr_0.7fr_0.7fr_auto]">
            <input
              value={row.key}
              onChange={(event) => onChange(index, "key", event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
            <input
              value={row.label}
              onChange={(event) => onChange(index, "label", event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
            <input
              type="number"
              value={row.rate}
              onChange={(event) => onChange(index, "rate", event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
            <input
              type="number"
              value={row.sortOrder}
              onChange={(event) => onChange(index, "sortOrder", event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={row.active === true}
                onChange={(event) => onChange(index, "active", event.target.checked)}
              />
              Aktif
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={row.default === true}
                onChange={(event) => onChange(index, "default", event.target.checked)}
              />
              Vars.
            </label>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              Sil
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
