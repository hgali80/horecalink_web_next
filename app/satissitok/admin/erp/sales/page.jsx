"use client";

import { useEffect, useState } from "react";
import ErpDocumentListView from "../_components/ErpDocumentListView";
import { listErpDocuments } from "../_services/erpDocumentsService";
import { ERP_COLLECTIONS } from "../_services/erpCollections";

export default function ErpSalesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const nextRows = await listErpDocuments(ERP_COLLECTIONS.SALES);
        if (!alive) return;
        setRows(nextRows);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Satis evraklari yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <LoadingShell label="Satis evraklari hazirlaniyor..." />;
  }

  if (error) {
    return <ErrorShell message={error} />;
  }

  return (
    <ErpDocumentListView
      title="Satis Evraklari"
      description="Bu alan tum satis belge ve fatura evraklarinin listelendigi ana ekran olacak. V1'de R/F filtreleri, draft-onayli-iptal kirilimlari ve platform bazli arama burada yer alacak."
      rows={rows}
      emptyTitle="Henuz ERP satis evraki yok"
      emptyText="Ilk asamada erp_sales koleksiyonu olusunca tum satis belge ve faturalarin burada toplu halde gorunmeye baslayacak. Bu ekran tum satis evrak listesinin ana merkezi olacak."
      newHref="/satissitok/admin/erp/sales/new"
      newLabel="Yeni Satis Belgesi"
      editHrefBase="/satissitok/admin/erp/sales"
    />
  );
}

function LoadingShell({ label }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
      {label}
    </div>
  );
}

function ErrorShell({ message }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
          ERP / Satislar
        </div>
        <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">Satis Evraklari</h2>
      </div>
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        {message}
      </div>
    </div>
  );
}
