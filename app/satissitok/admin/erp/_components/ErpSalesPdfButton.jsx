"use client";

import { createElement, useState } from "react";
import { FileDown } from "lucide-react";
import { getErpDocument } from "../_services/erpDocumentsService";
import { ERP_COLLECTIONS } from "../_services/erpCollections";

export default function ErpSalesPdfButton({ documentId }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function download(language) {
    if (busy || !documentId) return;
    setBusy(language);
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
        record, seller, language, fontUrl: new URL("/pdf/NotoSans.ttf", window.location.origin).href,
      })).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const number = String(record.invoiceNo || record.documentNo || record.draftNo || documentId).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
      link.download = `${record.docType === "F" ? "Nakladnaya" : "Schet-faktura"}-${number}-${language.toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Sales PDF download failed:", err);
      setError("PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy("");
    }
  }

  return <div className="inline-flex flex-col items-start gap-1">
    <div className="inline-flex flex-wrap gap-2">
      {[{ language: "ru", label: "PDF RU" }, { language: "kz", label: "PDF KZ" }].map((option) =>
        <button key={option.language} type="button" disabled={Boolean(busy) || !documentId} onClick={() => download(option.language)}
          title={`${option.language === "ru" ? "Rusça" : "Kazakça"} PDF indir`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50">
          <FileDown size={16} />{busy === option.language ? "Hazırlanıyor..." : option.label}
        </button>)}
    </div>
    {error ? <span role="alert" className="max-w-xs text-xs text-red-700">{error}</span> : null}
  </div>;
}
