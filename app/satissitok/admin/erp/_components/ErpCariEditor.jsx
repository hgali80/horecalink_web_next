"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getErpCari, getNextErpCariCodePreview, saveErpCari } from "../_services/erpCarisService";

function emptyBankAccount() {
  return {
    bankName: "",
    bik: "",
    iban: "",
    notes: "",
  };
}

export default function ErpCariEditor({ cariId = "" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/satissitok/admin/erp/caris";
  const isEdit = Boolean(cariId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [codePreview, setCodePreview] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    shortName: "",
    bin: "",
    kbe: "",
    directorName: "",
    phone: "",
    email: "",
    taxNo: "",
    taxOffice: "",
    address: "",
    legalAddress: "",
    bankAccounts: [emptyBankAccount()],
    notes: "",
    active: true,
    isCustomer: true,
    isSupplier: false,
    currency: "KZT",
    openingReceivable: "",
    openingPayable: "",
  });

  useEffect(() => {
    let alive = true;
    if (!isEdit) return undefined;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const next = await getErpCari(cariId);
        if (!alive) return;
        setForm({
          code: next.code || "",
          name: next.name || "",
          shortName: next.shortName || "",
          bin: next.bin || "",
          kbe: next.kbe || "",
          directorName: next.directorName || "",
          phone: next.phone || "",
          email: next.email || "",
          taxNo: next.taxNo || "",
          taxOffice: next.taxOffice || "",
          address: next.address || "",
          legalAddress: next.legalAddress || next.address || "",
          bankAccounts: next.bankAccounts?.length ? next.bankAccounts : [emptyBankAccount()],
          notes: next.notes || "",
          active: next.active !== false,
          isCustomer: next.isCustomer === true,
          isSupplier: next.isSupplier === true,
          currency: next.currency || "KZT",
          openingReceivable: String(next.openingReceivable ?? ""),
          openingPayable: String(next.openingPayable ?? ""),
        });
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Cari bilgisi yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [cariId, isEdit]);

  useEffect(() => {
    let alive = true;
    if (isEdit) return undefined;

    (async () => {
      try {
        const nextCode = await getNextErpCariCodePreview();
        if (!alive) return;
        setCodePreview(nextCode);
        setForm((current) => ({
          ...current,
          code: current.code || nextCode,
        }));
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [isEdit]);

  const typeLabel = useMemo(() => {
    if (form.isCustomer && form.isSupplier) return "Musteri + Tedarikci";
    if (form.isCustomer) return "Musteri";
    if (form.isSupplier) return "Tedarikci";
    return "Genel Cari";
  }, [form.isCustomer, form.isSupplier]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateBankAccount(index, field, value) {
    setForm((current) => ({
      ...current,
      bankAccounts: (current.bankAccounts || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addBankAccount() {
    setForm((current) => ({
      ...current,
      bankAccounts: [...(current.bankAccounts || []), emptyBankAccount()],
    }));
  }

  function removeBankAccount(index) {
    setForm((current) => {
      const nextRows = (current.bankAccounts || []).filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        bankAccounts: nextRows.length ? nextRows : [emptyBankAccount()],
      };
    });
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      setError("");
      setNotice("");

      if (!String(form.name || "").trim()) {
        throw new Error("Cari adi zorunlu.");
      }

      if (!form.isCustomer && !form.isSupplier) {
        throw new Error("Cari en az bir role sahip olmali.");
      }

      await saveErpCari({
        id: cariId,
        ...form,
      });

      setNotice(isEdit ? "Cari guncellendi." : "Yeni cari olusturuldu.");
      router.push(returnTo);
    } catch (err) {
      setError(err?.message || "Cari kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Shell tone="normal" text="Cari editoru hazirlaniyor..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
            ERP / Cariler
          </div>
          <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">
            {isEdit ? "Cari Duzenle" : "Yeni Cari"}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Cari kartini rekvizit mantigiyla kuruyoruz. Unvan, BIN, KBE, banka hesaplari, resmi adres ve
            yetkili kisi bilgileri tek kayitta toplanacak.
          </p>
        </div>

        <Link
          href={returnTo}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Listeye Don
        </Link>
      </div>

      {notice ? <Shell tone="success" text={notice} /> : null}
      {error ? <Shell tone="error" text={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            title="Temel Rekvizit"
            text="Resmi evrakta gorunecek unvan ve vergi kimlik bilgilerini bu alanda topla."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              label="Cari Kodu"
              value={form.code}
              onChange={(value) => setField("code", value)}
              hint={!isEdit ? `Bos birakirsan otomatik kod verilir. Siradaki kod: ${codePreview || "hazirlaniyor"}` : ""}
            />
            <InputField label="Resmi Unvan" value={form.name} onChange={(value) => setField("name", value)} />
            <InputField label="Kisa Ad / Marka" value={form.shortName} onChange={(value) => setField("shortName", value)} />
            <InputField label="BIN / Vergi No" value={form.bin} onChange={(value) => setField("bin", value)} />
            <InputField label="KBE" value={form.kbe} onChange={(value) => setField("kbe", value)} />
            <InputField label="Yetkili Kisi" value={form.directorName} onChange={(value) => setField("directorName", value)} />
            <InputField label="Telefon" value={form.phone} onChange={(value) => setField("phone", value)} />
            <InputField label="E-posta" value={form.email} onChange={(value) => setField("email", value)} />
            <InputField label="Para Birimi" value={form.currency} onChange={(value) => setField("currency", value)} />
            <InputField label="Vergi No Eski Alan" value={form.taxNo} onChange={(value) => setField("taxNo", value)} />
            <InputField label="Vergi Dairesi / Aciklama" value={form.taxOffice} onChange={(value) => setField("taxOffice", value)} />
            <InputField
              label="Acilis Alacagi"
              type="number"
              value={form.openingReceivable}
              onChange={(value) => setField("openingReceivable", value)}
            />
            <InputField
              label="Acilis Borcu"
              type="number"
              value={form.openingPayable}
              onChange={(value) => setField("openingPayable", value)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TextAreaField
              label="Resmi Adres"
              value={form.legalAddress}
              onChange={(value) => setField("legalAddress", value)}
              rows={5}
            />
            <TextAreaField
              label="Operasyonel Adres"
              value={form.address}
              onChange={(value) => setField("address", value)}
              rows={5}
            />
          </div>

          <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Banka Rekvizitleri</div>
                <div className="mt-1 text-sm text-slate-600">
                  Bir cari icin birden fazla banka hesabi tanimlayabilirsin.
                </div>
              </div>
              <button
                type="button"
                onClick={addBankAccount}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Banka Hesabi Ekle
              </button>
            </div>

            <div className="space-y-4">
              {(form.bankAccounts || []).map((account, index) => (
                <div key={`bank_${index}`} className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-bold text-slate-900">Banka Hesabi {index + 1}</div>
                    {(form.bankAccounts || []).length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeBankAccount(index)}
                        className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                      >
                        Kaldir
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField
                      label="Banka Adi"
                      value={account.bankName}
                      onChange={(value) => updateBankAccount(index, "bankName", value)}
                    />
                    <InputField
                      label="BIC / SWIFT"
                      value={account.bik}
                      onChange={(value) => updateBankAccount(index, "bik", value)}
                    />
                    <InputField
                      label="IBAN / Hesap No"
                      value={account.iban}
                      onChange={(value) => updateBankAccount(index, "iban", value)}
                    />
                    <InputField
                      label="Not"
                      value={account.notes}
                      onChange={(value) => updateBankAccount(index, "notes", value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <TextAreaField label="Notlar" value={form.notes} onChange={(value) => setField("notes", value)} rows={4} />
        </section>

        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <InfoBox title="Cari Rol Ayari">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isCustomer === true}
                onChange={(event) => setField("isCustomer", event.target.checked)}
              />
              Musteri olarak kullan
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isSupplier === true}
                onChange={(event) => setField("isSupplier", event.target.checked)}
              />
              Tedarikci olarak kullan
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active === true}
                onChange={(event) => setField("active", event.target.checked)}
              />
              Aktif cari
            </label>
          </InfoBox>

          <InfoBox title="Ozet">
            <InfoRow label="Rol" value={typeLabel} />
            <InfoRow label="Durum" value={form.active ? "Aktif" : "Pasif"} />
            <InfoRow label="Resmi Unvan" value={form.name || "-"} />
            <InfoRow label="Cari Kodu" value={form.code || codePreview || "-"} />
            <InfoRow label="BIN / Vergi No" value={form.bin || form.taxNo || "-"} />
            <InfoRow label="KBE" value={form.kbe || "-"} />
            <InfoRow label="Para Birimi" value={form.currency || "KZT"} />
            <InfoRow label="Banka Hesabi" value={String((form.bankAccounts || []).filter((item) => item.bankName || item.iban).length)} />
          </InfoBox>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={returnTo}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Vazgec
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : isEdit ? "Degisiklikleri Kaydet" : "Cariyi Olustur"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ title, text }) {
  return (
    <div className="space-y-1">
      <h3 className="text-lg font-black tracking-[-0.03em] text-[#1d3246]">{title}</h3>
      <p className="text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", hint = "" }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
      />
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
      />
    </label>
  );
}

function InfoBox({ title, children }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function Shell({ text, tone }) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-white text-slate-600";

  return <div className={`rounded-[28px] border p-6 text-sm leading-7 shadow-sm ${className}`}>{text}</div>;
}
