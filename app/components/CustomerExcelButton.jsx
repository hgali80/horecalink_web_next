"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { useLang } from "@/app/context/LanguageContext";

export default function CustomerExcelButton({ document, calculated, onError }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    onError("");
    try {
      const { downloadCustomerExcel } = await import("@/app/lib/customerExcelExport");
      await downloadCustomerExcel({ document, calculated, t });
    } catch (error) {
      console.error("Customer Excel export failed:", error);
      onError(t("customerExcel.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={download} disabled={busy || !document?.items?.length} aria-busy={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
      <FileSpreadsheet size={17} />
      {t(busy ? "customerExcel.preparing" : "customerExcel.download")}
    </button>
  );
}
