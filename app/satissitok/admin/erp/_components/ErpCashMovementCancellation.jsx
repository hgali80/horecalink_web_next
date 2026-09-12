"use client";

import { useId, useRef, useState } from "react";
import { cancelErpCashMovement } from "../_services/erpCashMovementCancellation";

export default function ErpCashMovementCancellation({ record, onCancelled }) {
  const dialog = useRef(null);
  const titleId = useId();
  const inFlight = useRef(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = record.direction === "out" ? "Ödemeyi iptal et" : "Tahsilatı iptal et";
  if (["cancelled", "canceled", "void"].includes(record.status)) return (
    <div className="min-w-[160px] text-xs text-rose-800">
      <strong>İptal edildi</strong>
      <div>{record.cancelledDateLabel} · {record.cancelledByName}</div>
      <div className="mt-1 whitespace-pre-wrap break-words">{record.cancellationReason}</div>
    </div>
  );
  if (!["manual", "document_settlement", "collection", "payment"].includes(record.kind || "manual")) return null;
  async function cancel(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await cancelErpCashMovement({ movementId: record.id, reason });
      dialog.current.close();
      onCancelled();
    } catch (err) {
      setError(err.message || "Hareket iptal edilemedi.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return <>
    <button type="button" onClick={() => { setError(""); setReason(""); dialog.current.showModal(); }} className="whitespace-nowrap rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">{label}</button>
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { if (busy) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl p-6 text-left shadow-xl backdrop:bg-slate-950/50">
      <form onSubmit={cancel} className="space-y-4">
        <h3 id={titleId} className="text-lg font-bold text-slate-900">{label}</h3>
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <strong>{record.receiptNo}</strong> · {record.cariName || "Cari yok"}<br />
          {record.accountName} · {record.dateLabel}<br />
          <strong>{Number(record.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {record.currency}</strong>
          {record.documentNo || record.originalDocumentNo ? <div>Fatura: {record.documentNo || record.originalDocumentNo}</div> : null}
        </div>
        <p className="text-sm text-slate-600">Bu işlem hatalı veya mükerrer kaydı iptal eder. Gerçek para iadesi yapıldıysa ayrı ödeme/tahsilat kaydı kullanılmalıdır.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Kasa/banka ve cari üzerindeki bu hareketin etkisi geri alınır.</li>
          <li>Tutar aktif giriş–çıkış toplamlarından çıkarılır; ciro değişmez.</li>
          {record.documentId ? <li>Faturanın kalan tutarı artırılır ve ödeme durumu yeniden açılır.</li> : null}
          {record.advanceFromCancellation ? <li>İptal edilen faturadan kalan avans azaltılır; fatura iptal edilmiş olarak kalır.</li> : null}
          <li>Kayıt silinmez; iptal gerekçesi, tarihi ve işlemi yapan kişi saklanır.</li>
        </ul>
        <label className="block text-sm font-semibold">İptal gerekçesi<textarea autoFocus required maxLength={1000} rows={3} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
        {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => dialog.current.close()} className="rounded-xl border px-4 py-2 disabled:opacity-50">Vazgeç</button>
          <button type="submit" disabled={busy || !reason.trim()} className="rounded-xl bg-rose-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "İptal ediliyor…" : "İptali onayla"}</button>
        </div>
      </form>
    </dialog>
  </>;
}
