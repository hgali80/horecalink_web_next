"use client";

import { useRef, useState } from "react";
import { cancelErpDocument } from "../_services/erpDocumentCancellationService";
import { formatErpDate } from "../_services/erpDocumentsService";

export default function ErpDocumentCancellation({ kind, record, onCancelled }) {
  const dialog = useRef(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!record || !["confirmed", "cancelled"].includes(record.status)) return null;
  if (record.status === "cancelled") return <div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
    <strong>İptal edildi</strong> · {formatErpDate(record.cancelledAt)} · {record.cancelledByName || record.cancelledBy}
    <p className="mt-1 whitespace-pre-wrap">Gerekçe: {record.cancellationReason}</p>
    <p className="mt-1">Bu fatura stok, ciro, kâr ve cari fatura bakiyesine dahil edilmez.</p>
    {Number(record.retainedAdvanceAmount) > 0 ? <p className="mt-1">{Number(record.retainedAdvanceAmount).toLocaleString("tr-TR")} KZT ödeme/tahsilat cari avans olarak korundu.</p> : null}
  </div>;

  async function cancel(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await cancelErpDocument({ kind, documentId: record.id, reason });
      dialog.current.close();
      onCancelled({ ...record, ...result, status: "cancelled", cancellationReason: reason.trim(), cancelledAt: new Date() });
    } catch (err) {
      setError(err.message || "Fatura iptal edilemedi.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="flex justify-end">
    <button type="button" onClick={() => { setError(""); dialog.current.showModal(); }} className="rounded-xl border border-rose-300 bg-white px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50">
      Faturayı iptal et
    </button>
    <dialog ref={dialog} aria-labelledby="cancel-invoice-title" onCancel={event => { if (busy) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl p-6 shadow-xl backdrop:bg-slate-950/50">
      <form onSubmit={cancel} className="space-y-4">
        <h3 id="cancel-invoice-title" className="text-xl font-bold">{kind === "sales" ? "Satış" : "Satın alma"} faturasını iptal et</h3>
        <p className="font-semibold">{record.invoiceNo || record.documentNo} · {record.cariName}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>{kind === "sales" ? "Satılan miktarlar stoka geri eklenir." : "Satın alınan miktarlar stoktan çıkarılır; bu işlem negatif stok oluşturabilir."}</li>
          <li>Fatura ciro, kâr, cari fatura bakiyesi ve raporlardan çıkarılır. Etkilenen sonraki satışların maliyet ve kârı yeniden hesaplanır.</li>
          <li>Mevcut ödeme/tahsilatlar kasa ve bankada kalır; cari avansa dönüşür. Para iadesi ayrı bir finans hareketidir.</li>
          <li>Fatura geçmişi korunur. İptal edilen fatura yeniden onaylanamaz; yeni taslak olarak kopyalanabilir.</li>
        </ul>
        <label className="block text-sm font-semibold">İptal gerekçesi
          <textarea required autoFocus maxLength={1000} rows={3} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" />
        </label>
        {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => dialog.current.close()} className="rounded-xl border px-4 py-2 disabled:opacity-50">Vazgeç</button>
          <button type="submit" disabled={busy || !reason.trim()} className="rounded-xl bg-rose-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "İptal ediliyor…" : "İptali onayla"}</button>
        </div>
      </form>
    </dialog>
  </div>;
}
