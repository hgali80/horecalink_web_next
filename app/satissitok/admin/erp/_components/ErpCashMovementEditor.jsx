"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { listErpCariOptions } from "../_services/erpCarisService";
import {
  createErpManualCashMovement,
  listErpCashAccountOptions,
} from "../_services/erpFinanceService";
import { getErpSettings } from "../_services/erpSettingsService";

function defaultDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function ErpCashMovementEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/satissitok/admin/erp/finance";
  const preCariId = searchParams.get("cariId") || "";
  const preCariName = searchParams.get("cariName") || "";
  const preDirection = searchParams.get("direction") || "in";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [caris, setCaris] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState({
    direction: preDirection === "out" ? "out" : "in",
    kind: "manual",
    accountId: "",
    cariId: preCariId,
    cariName: preCariName,
    method: "",
    amount: "",
    movementDate: defaultDate(),
    notes: "",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const [accountRows, cariRows, settings] = await Promise.all([
          listErpCashAccountOptions(),
          listErpCariOptions(),
          getErpSettings(),
        ]);
        if (!alive) return;

        const methods = settings.paymentMethods || [];
        setAccounts(accountRows);
        setCaris(cariRows);
        setPaymentMethods(methods);
        setForm((current) => ({
          ...current,
          accountId: current.accountId || accountRows?.[0]?.value || "",
          method: current.method || methods?.find((item) => item.default)?.key || methods?.[0]?.key || "",
        }));
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Tahsilat / odeme editoru yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleCariChange(value) {
    const selected = caris.find((item) => item.value === value);
    setForm((current) => ({
      ...current,
      cariId: value,
      cariName: selected?.name || current.cariName,
    }));
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      setError("");
      await createErpManualCashMovement(form);
      router.push(returnTo);
    } catch (err) {
      setError(err?.message || "Hareket kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Shell text="Tahsilat / odeme editoru hazirlaniyor..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
            ERP / Finans / Manuel Hareket
          </div>
          <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">
            {form.direction === "out" ? "Yeni Odeme" : "Yeni Tahsilat"}
          </h2>
        </div>

        <Link
          href={returnTo}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Geri Don
        </Link>
      </div>

      {error ? <Shell tone="error" text={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Yon"
              value={form.direction}
              onChange={(value) => setField("direction", value)}
              options={[
                { value: "in", label: "Tahsilat / Giris" },
                { value: "out", label: "Odeme / Cikis" },
              ]}
            />

            <InputField
              label="Tarih"
              type="date"
              value={form.movementDate}
              onChange={(value) => setField("movementDate", value)}
            />

            <SelectField
              label="Kasa / Banka Hesabi"
              value={form.accountId}
              onChange={(value) => setField("accountId", value)}
              options={accounts.map((item) => ({
                value: item.value,
                label: item.active ? item.label : `${item.label} (pasif)`,
              }))}
            />

            <SelectField
              label="Odeme Yontemi"
              value={form.method}
              onChange={(value) => setField("method", value)}
              options={paymentMethods.map((item) => ({ value: item.key, label: item.label }))}
            />

            <SelectField
              label="Cari Secimi"
              value={form.cariId}
              onChange={handleCariChange}
              options={caris.map((item) => ({
                value: item.value,
                label: item.isActive ? item.label : `${item.label} (pasif)`,
              }))}
            />

            <InputField
              label="Cari Adi"
              value={form.cariName}
              onChange={(value) => setField("cariName", value)}
            />

            <InputField
              label="Tutar"
              type="number"
              value={form.amount}
              onChange={(value) => setField("amount", value)}
            />
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Notlar</span>
            <textarea
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
            />
          </label>
        </section>

        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Bu ekran kaydedildiginde ayni anda:
            <br />
            `erp_cash_movements` kaydi olusur,
            <br />
            secilen hesap bakiyesi guncellenir,
            <br />
            cari seciliyse `erp_cari_movements` kaydi da olusur.
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : form.direction === "out" ? "Odemeyi Kaydet" : "Tahsilati Kaydet"}
          </button>
        </section>
      </div>
    </div>
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
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
      >
        <option value="">Sec</option>
        {(options || []).map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Shell({ text, tone = "normal" }) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-white text-slate-600";

  return <div className={`rounded-[28px] border p-6 text-sm leading-7 shadow-sm ${className}`}>{text}</div>;
}
