"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createErpDocumentSettlement,
  listErpCashAccountOptions,
  listErpOpenDocuments,
} from "../_services/erpFinanceService";
import { getErpSettings } from "../_services/erpSettingsService";

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KZT`;
}

function defaultDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function ErpDocumentSettlementEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/satissitok/admin/erp/finance";
  const preCariId = searchParams.get("cariId") || "";
  const preDocumentId = searchParams.get("documentId") || "";
  const preDocumentCollection = searchParams.get("documentCollection") || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState({
    documentId: "",
    documentCollection: "",
    accountId: "",
    amount: "",
    method: "",
    movementDate: defaultDate(),
    notes: "",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const [accountRows, openDocs, settings] = await Promise.all([
          listErpCashAccountOptions(),
          listErpOpenDocuments(preCariId),
          getErpSettings(),
        ]);
        if (!alive) return;

        const methods = settings.paymentMethods || [];
        const preselectedDoc = openDocs.find(
          (item) => item.id === preDocumentId && item.documentCollection === preDocumentCollection
        );
        const firstDoc = preselectedDoc || openDocs[0];

        setAccounts(accountRows);
        setDocuments(openDocs);
        setPaymentMethods(methods);
        setForm((current) => ({
          ...current,
          accountId: current.accountId || accountRows?.[0]?.value || "",
          method: current.method || methods?.find((item) => item.default)?.key || methods?.[0]?.key || "",
          documentId: current.documentId || firstDoc?.id || "",
          documentCollection: current.documentCollection || firstDoc?.documentCollection || "",
          amount: current.amount || String(firstDoc?.outstandingAmount || ""),
        }));
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Belge kapama editoru yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [preCariId, preDocumentCollection, preDocumentId]);

  const selectedDocument = useMemo(() => {
    return documents.find(
      (item) => item.id === form.documentId && item.documentCollection === form.documentCollection
    );
  }, [documents, form.documentCollection, form.documentId]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleDocumentChange(rawValue) {
    const [documentCollection, documentId] = String(rawValue || "").split("::");
    const selected = documents.find(
      (item) => item.id === documentId && item.documentCollection === documentCollection
    );

    setForm((current) => ({
      ...current,
      documentId: documentId || "",
      documentCollection: documentCollection || "",
      amount: selected ? String(selected.outstandingAmount || "") : current.amount,
    }));
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      setError("");
      await createErpDocumentSettlement(form);
      router.push(returnTo);
    } catch (err) {
      setError(err?.message || "Belge kapama kaydi olusturulamadi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Shell text="Belge kapama editoru hazirlaniyor..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
            ERP / Finans / Belge Kapama
          </div>
          <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">
            Acik Belge Tahsilat / Odeme
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
          <SelectField
            label="Acik Belge"
            value={form.documentId && form.documentCollection ? `${form.documentCollection}::${form.documentId}` : ""}
            onChange={handleDocumentChange}
            options={documents.map((item) => ({
              value: `${item.documentCollection}::${item.id}`,
              label: `${item.documentKind === "sales" ? "Satis" : "Satinalma"} / ${item.documentNo || item.invoiceNo || item.id} / ${item.cariName || "-"} / Kalan ${fmtMoney(item.outstandingAmount)}`,
            }))}
          />

          <div className="grid gap-4 md:grid-cols-2">
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

            <InputField
              label="Kapama Tutari"
              type="number"
              value={form.amount}
              onChange={(value) => setField("amount", value)}
            />

            <InputField
              label="Tarih"
              type="date"
              value={form.movementDate}
              onChange={(value) => setField("movementDate", value)}
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
          {selectedDocument ? (
            <>
              <InfoRow label="Belge Turu" value={selectedDocument.documentKind === "sales" ? "Satis" : "Satinalma"} />
              <InfoRow label="Belge No" value={selectedDocument.documentNo || "-"} />
              <InfoRow label="Fatura No" value={selectedDocument.invoiceNo || "-"} />
              <InfoRow label="Cari" value={selectedDocument.cariName || "-"} />
              <InfoRow label="Belge Toplami" value={fmtMoney(selectedDocument.totalAmount)} />
              <InfoRow label="Odenen / Tahsil Edilen" value={fmtMoney(selectedDocument.settledAmount)} />
              <InfoRow label="Kalan Tutar" value={fmtMoney(selectedDocument.outstandingAmount)} />
              <InfoRow label="Yeni Kalan" value={fmtMoney(Math.max((selectedDocument.outstandingAmount || 0) - Number(form.amount || 0), 0))} />
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Once kapatilacak belgeyi sec.
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !selectedDocument}
            className="w-full rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Belgeyi Kapat"}
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

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function Shell({ text, tone = "normal" }) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-white text-slate-600";

  return <div className={`rounded-[28px] border p-6 text-sm leading-7 shadow-sm ${className}`}>{text}</div>;
}
