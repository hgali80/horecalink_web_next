"use client";

import { createElement, useState } from "react";
import { FileDown } from "lucide-react";
import { getErpDocument } from "../_services/erpDocumentsService";
import { ERP_COLLECTIONS } from "../_services/erpCollections";

export default function ErpSalesPdfButton({ documentId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (busy || !documentId) return;
    setBusy(true);
    setError("");
    try {
      const record = await getErpDocument(ERP_COLLECTIONS.SALES, documentId);
      const [{ pdf }, { default: SalesPdf }, { buildDefaultOfferPayload }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./ErpSalesPdf"),
        import("@/app/satissitok/services/commercialOfferService"),
      ]);
      const seller = record.sellerSnapshot || buildDefaultOfferPayload({}).seller;
      const blob = await pdf(createElement(SalesPdf, {
        record, seller, fontUrl: new URL("/pdf/NotoSans.ttf", window.location.origin).href,
      })).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const number = String(record.invoiceNo || record.documentNo || record.draftNo || documentId).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
      link.download = `Satis-${number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Sales PDF download failed:", err);
      setError("PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="inline-flex flex-col items-start gap-1">
    <button type="button" disabled={busy || !documentId} onClick={download}
      title="Faturanın son kaydedilen halini PDF olarak indir"
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50">
      <FileDown size={16} />{busy ? "PDF hazırlanıyor..." : "PDF indir"}
    </button>
    {error ? <span role="alert" className="max-w-xs text-xs text-red-700">{error}</span> : null}
  </div>;
}
