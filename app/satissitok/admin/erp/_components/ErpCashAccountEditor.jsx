"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getErpCashAccount, saveErpCashAccount } from "../_services/erpFinanceService";

export default function ErpCashAccountEditor({ accountId = "" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/satissitok/admin/erp/finance";
  const isEdit = Boolean(accountId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "cash",
    currency: "KZT",
    openingBalance: "",
    currentBalance: "",
    notes: "",
    active: true,
  });

  useEffect(() => {
    let alive = true;
    if (!isEdit) return undefined;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const next = await getErpCashAccount(accountId);
        if (!alive) return;
        setForm({
          code: next.code || "",
          name: next.name || "",
          type: next.type || "cash",
          currency: next.currency || "KZT",
          openingBalance: String(next.openingBalance ?? ""),
          currentBalance: String(next.currentBalance ?? ""),
          notes: next.notes || "",
          active: next.active !== false,
        });
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Finans hesabi yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [accountId, isEdit]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      setError("");
      if (!String(form.name || "").trim()) {
        throw new Error("Hesap adi zorunlu.");
      }

      await saveErpCashAccount({
        id: accountId,
        ...form,
      });

      router.push(returnTo);
    } catch (err) {
      setError(err?.message || "Finans hesabi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Shell tone="normal" text="Finans hesap editoru hazirlaniyor..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
            ERP / Finans
          </div>
          <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">
            {isEdit ? "Hesap Duzenle" : "Yeni Finans Hesabi"}
          </h2>
        </div>

        <Link
          href={returnTo}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Finansa Don
        </Link>
      </div>

      {error ? <Shell tone="error" text={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Hesap Kodu" value={form.code} onChange={(value) => setField("code", value)} />
            <InputField label="Hesap Adi" value={form.name} onChange={(value) => setField("name", value)} />
            <SelectField
              label="Hesap Tipi"
              value={form.type}
              onChange={(value) => setField("type", value)}
              options={[
                { value: "cash", label: "Kasa" },
                { value: "bank", label: "Banka" },
              ]}
            />
            <InputField label="Para Birimi" value={form.currency} onChange={(value) => setField("currency", value)} />
            <InputField
              label="Acilis Bakiyesi"
              type="number"
              value={form.openingBalance}
              onChange={(value) => setField("openingBalance", value)}
            />
            <InputField
              label="Guncel Bakiye"
              type="number"
              value={form.currentBalance}
              onChange={(value) => setField("currentBalance", value)}
            />
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Notlar</span>
            <textarea
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
            />
          </label>
        </section>

        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active === true}
              onChange={(event) => setField("active", event.target.checked)}
            />
            Aktif hesap
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Bu fazda hesap kartlarini ayiriyoruz. Bir sonraki asamada manuel tahsilat, odeme ve virman
            islemlerini bu hesaplara baglayacagiz.
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : isEdit ? "Hesabi Kaydet" : "Hesabi Olustur"}
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
        {(options || []).map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Shell({ text, tone }) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-white text-slate-600";

  return <div className={`rounded-[28px] border p-6 text-sm leading-7 shadow-sm ${className}`}>{text}</div>;
}
