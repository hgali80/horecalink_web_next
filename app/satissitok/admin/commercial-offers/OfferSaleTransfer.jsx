"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, X } from "lucide-react";
import { listErpCaris } from "../erp/_services/erpCarisService";
import { getErpSettings } from "../erp/_services/erpSettingsService";
import { convertCommercialOfferToSale } from "../erp/_services/erpDocumentMutationService";

const fieldClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export default function OfferSaleTransfer({ offerId, offer, disabled }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(null);
  const [caris, setCaris] = useState([]);
  const [docType, setDocType] = useState("");
  const [cariMode, setCariMode] = useState("existing");
  const [cariId, setCariId] = useState("");
  const [newCari, setNewCari] = useState({});

  async function openDialog() {
    setDocType("");
    setCariMode("existing");
    setCariId("");
    setError("");
    const buyer = offer.buyer || {};
    setNewCari({
      name: buyer.companyName || buyer.contactName || "", bin: buyer.bin || "",
      phone: buyer.phone || "", email: buyer.email || "", address: buyer.address || "",
      contactName: buyer.contactName || "",
    });
    dialogRef.current.showModal();
    setLoading(true);
    setSettings(null);
    try {
      const [rows, nextSettings] = await Promise.all([listErpCaris(), getErpSettings()]);
      setCaris(rows.filter((row) => row.isActive));
      setSettings(nextSettings);
    } catch (err) {
      setError(err?.message || "ERP bilgileri yüklenemedi. Pencereyi kapatıp tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function transfer(event) {
    event.preventDefault();
    if (submittingRef.current || loading || !settings) return;
    submittingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await convertCommercialOfferToSale({
        offerId, offerPayload: offer, docType, settings,
        cariId: cariMode === "existing" ? cariId : "",
        newCari: cariMode === "new" ? newCari : null,
      });
      router.push(`/satissitok/admin/erp/sales/${result.id}`);
    } catch (err) {
      setError(err?.message || "Satış taslağı oluşturulamadı. Tekrar deneyebilirsiniz.");
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return <>
    {offer.salesDocumentId ? (
      <Link href={`/satissitok/admin/erp/sales/${offer.salesDocumentId}`} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
        <ArrowRightLeft size={16} /> Bağlı Satış Faturasını Aç
      </Link>
    ) : (
      <button type="button" onClick={openDialog} disabled={disabled || !offerId}
        title={!offerId ? "Aktarmadan önce teklifi kaydedin." : "Teklif fiyatlarıyla satış taslağı oluştur"}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        <ArrowRightLeft size={16} /> Satış Faturasına Aktar
      </button>
    )}
    <dialog ref={dialogRef} aria-labelledby="offer-transfer-title" onCancel={(event) => { if (busy) event.preventDefault(); }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-900/50">
      <div className="flex items-center justify-between gap-3">
        <h2 id="offer-transfer-title" className="text-xl font-bold">Satış Faturasına Aktar</h2>
        <button type="button" aria-label="Kapat" disabled={busy} onClick={() => dialogRef.current.close()} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50"><X size={20} /></button>
      </div>
      <p className="mt-3 text-sm text-slate-600">{offer.offerNo}: Son değişiklikleriniz kaydedilir ve teklif fiyatlarıyla satış taslağı açılır. Stok ve cari hareketleri satış belgesini onayladığınızda oluşur.</p>
      <form onSubmit={transfer} className="mt-5 space-y-5">
        <fieldset disabled={busy || loading} className="space-y-5 disabled:opacity-60">
          <div>
            <p className="mb-2 text-sm font-semibold">Belge tipi</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: "R", label: "Resmî (R)" }, { value: "F", label: "Fiilî (F)" }].map((option) => (
                <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-4 text-sm font-semibold ${docType === option.value ? "border-blue-600 bg-blue-50" : "border-slate-300"}`}>
                  <input required type="radio" name="saleDocType" value={option.value} checked={docType === option.value} onChange={() => setDocType(option.value)} />{option.label}
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm font-semibold">Cari işlemi
            <select value={cariMode} onChange={(event) => setCariMode(event.target.value)} className={fieldClass}>
              <option value="existing">Mevcut ERP carisini seç</option>
              <option value="new">Teklif bilgilerinden yeni cari oluştur</option>
            </select>
          </label>
          {cariMode === "existing" ? <label className="block text-sm font-semibold">ERP carisi
            <select required value={cariId} onChange={(event) => setCariId(event.target.value)} className={fieldClass}>
              <option value="">Cari seçin</option>
              {caris.map((cari) => <option key={cari.id} value={cari.id}>{cari.name} {cari.code ? `(${cari.code})` : ""} {cari.bin ? `— ${cari.bin}` : ""}</option>)}
            </select>
            <span className="mt-2 block text-xs font-normal text-slate-500">Teklif müşterisi: {offer.buyer?.companyName || offer.buyer?.contactName || "Belirtilmedi"}</span>
          </label> : <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["name", "Firma / müşteri adı"], ["bin", "BIN / IIN"], ["contactName", "Yetkili"],
              ["phone", "Telefon"], ["email", "E-posta"], ["address", "Adres"],
            ].map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}
              <input required={key === "name"} type={key === "email" ? "email" : "text"} value={newCari[key] || ""}
                onChange={(event) => setNewCari((current) => ({ ...current, [key]: event.target.value }))} className={fieldClass} />
            </label>)}
          </div>}
        </fieldset>
        {offer.items?.some((item) => !item.productId) ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Katalog ürünüyle eşleşmeyen manuel satırlar stok takibi olmadan aktarılır.</p> : null}
        {loading ? <p role="status" className="text-sm text-slate-500">ERP bilgileri yükleniyor...</p> : null}
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => dialogRef.current.close()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Vazgeç</button>
          <button type="submit" disabled={busy || loading || !settings || !docType || (cariMode === "existing" && !cariId)} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Aktarılıyor..." : "Satış Taslağını Aç"}</button>
        </div>
      </form>
    </dialog>
  </>;
}
