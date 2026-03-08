// app/satissitok/admin/purchases/new/components/PurchaseForm.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PurchaseItemsTable from "./PurchaseItemsTable";
import { getSettings } from "@/app/satissitok/services/settingsService";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Paperclip,
  Save,
  Trash2,
  Clock3,
} from "lucide-react";

/* ===============================
   YARDIMCI
================================ */

function pad6(n) {
  return String(Number(n) || 0).padStart(6, "0");
}

function year2FromDateISO(dateISO) {
  if (!dateISO) return String(new Date().getFullYear()).slice(-2);
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime())
    ? String(new Date().getFullYear()).slice(-2)
    : String(d.getFullYear()).slice(-2);
}

// PR-26-000001 / PF-26-000001
function formatInvoiceNo(type, yy, seq) {
  const prefix = type === "official" ? "PR" : "PF";
  return `${prefix}-${yy}-${pad6(seq)}`;
}

// PD-26-000001
function formatDraftNo(yy, seq) {
  return `PD-${yy}-${pad6(seq)}`;
}

function fmtMoney(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toISODate(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value?.toDate) {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function normalizeStatus(s) {
  const x = String(s || "draft").trim().toLowerCase();
  if (x === "draft" || x === "pending" || x === "completed") return x;
  return "draft";
}

export default function PurchaseForm({
  onSubmit,
  initialData = null,
  onDeleteDraft = null,
}) {
  /* ===============================
     DURUM / TÜR
  ================================ */

  // draft | pending | completed
  const [status, setStatus] = useState("draft");

  // official | actual
  const [purchaseType, setPurchaseType] = useState("official");

  // inclusive | exclusive
  const [vatMode, setVatMode] = useState("inclusive");

  /* ===============================
     AYARLAR
  ================================ */

  const [vatRates, setVatRates] = useState([]);
  const [selectedVat, setSelectedVat] = useState(16);

  const [warehouses, setWarehouses] = useState([]);
  const [warehouseKey, setWarehouseKey] = useState("main");

  /* ===============================
     TEDARİKÇİ / LOJİSTİK
  ================================ */

  const [supplierCariId, setSupplierCariId] = useState(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierBin, setSupplierBin] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceNoDirty, setInvoiceNoDirty] = useState(false);
  const loadingInvoiceRef = useRef(false);

  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [purchaseId, setPurchaseId] = useState("");

  /* ===============================
     CARİ DROPDOWN
  ================================ */

  const [cariSearch, setCariSearch] = useState("");
  const [caris, setCaris] = useState([]);
  const [cariOpen, setCariOpen] = useState(false);
  const cariLoadingRef = useRef(false);

  /* ===============================
     SATIRLAR
  ================================ */

  const [items, setItems] = useState([]);

  /* ===============================
     ÖDEME / NOT
  ================================ */

  const [paymentMethod, setPaymentMethod] = useState("bank"); // bank | cash | kaspi
  const [isPaid, setIsPaid] = useState(false);
  const [paidDate, setPaidDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState([]); // metadata only

  const isEditMode = !!(initialData?.id || initialData?.purchaseId || purchaseId);
  const isDraftLike = status !== "completed";

  /* ===============================
     SETTINGS LOAD
  ================================ */

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();

      const vats = settings?.taxes?.vat || [];
      setVatRates(vats);
      const defVat = vats.find((v) => v.default === true);
      setSelectedVat(defVat ? Number(defVat.rate) : 16);

      const wh = (settings?.warehouses || []).filter((w) => w.active !== false);
      setWarehouses(wh);
      const defWh = wh.find((w) => w.default === true) || wh[0];
      setWarehouseKey(defWh?.key || "main");
    };
    loadSettings();
  }, []);

  /* ===============================
     INITIAL DATA LOAD (EDIT)
  ================================ */

  useEffect(() => {
    if (!initialData) return;

    setPurchaseId(initialData.id || initialData.purchaseId || "");
    setStatus(normalizeStatus(initialData.status || "draft"));
    setPurchaseType(
      initialData.purchaseType === "actual" ? "actual" : "official"
    );
    setVatMode(initialData.vatMode || "inclusive");

    const taxRate =
      Number(
        initialData.taxRate ??
          initialData.totals?.taxRate ??
          initialData.vatRate ??
          0
      ) || 0;

    if (taxRate > 0) setSelectedVat(taxRate);

    setSupplierCariId(initialData.supplierCariId || null);
    setSupplierName(initialData.supplierName || "");
    setSupplierBin(initialData.supplierBin || "");
    setSupplierRef(initialData.supplierRef || "");
    setResponsiblePerson(initialData.responsiblePerson || "");

    const resolvedInvoice =
      initialData.invoiceNo ||
      initialData.documentNo ||
      initialData.draftNo ||
      "";

    setInvoiceNo(resolvedInvoice);
    setInvoiceNoDirty(!!resolvedInvoice);

    const dt =
      toISODate(initialData.documentDate) ||
      toISODate(initialData.invoiceDate) ||
      new Date().toISOString().slice(0, 10);

    setDocumentDate(dt);

    setWarehouseKey(initialData.warehouseKey || "main");

    setCariSearch(initialData.supplierName || "");

    setItems(Array.isArray(initialData.items) ? initialData.items : []);

    const payment = initialData.payment || {};
    const paymentMethodResolved =
      payment.method || initialData.paymentMethod || "bank";
    setPaymentMethod(paymentMethodResolved);

    const paid =
      payment.isPaid === true ||
      (!!payment.paidAmount && Number(payment.paidAmount) > 0);
    setIsPaid(!!paid);
    setPaidDate(
      toISODate(payment.paidDate) || toISODate(initialData.paidDate) || ""
    );

    setDueDate(toISODate(initialData.dueDate) || "");
    setNotes(initialData.notes || "");
    setAttachments(
      Array.isArray(initialData.attachments) ? initialData.attachments : []
    );
  }, [initialData]);

  /* ===============================
     CARİ LOAD
  ================================ */

  useEffect(() => {
    const loadCaris = async () => {
      if (cariLoadingRef.current) return;
      cariLoadingRef.current = true;

      try {
        const q = query(
          collection(db, "caris"),
          where("isActive", "==", true),
          where("type", "in", ["supplier", "both"]),
          orderBy("createdAt", "desc"),
          limit(500)
        );

        const snap = await getDocs(q);
        setCaris(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("CARIS LOAD ERROR:", e);
        setCaris([]);
      } finally {
        cariLoadingRef.current = false;
      }
    };

    loadCaris();
  }, []);

  const filteredCaris = useMemo(() => {
    const q = (cariSearch || "").trim().toLowerCase();
    if (!q) return caris;
    return caris.filter((c) => {
      const firm = (c.firm || "").toLowerCase();
      const bin = (c.bin || "").toLowerCase();
      const mobile = (c.mobile || "").toLowerCase();
      return firm.includes(q) || bin.includes(q) || mobile.includes(q);
    });
  }, [caris, cariSearch]);

  const selectCari = (c) => {
    setSupplierCariId(c.id);
    setSupplierName(c.firm || "");
    setSupplierBin(c.bin || "");
    setCariSearch(c.firm || "");
    setCariOpen(false);
  };

  const clearCari = () => {
    setSupplierCariId(null);
    setCariSearch("");
  };

  /* ===============================
     FATURA TÜRÜ → KDV / FATURA NO
  ================================ */

  useEffect(() => {
    if (purchaseType === "actual") {
      setSelectedVat(0);
    } else if (!initialData) {
      const def = vatRates.find((v) => v.default === true);
      setSelectedVat(def ? Number(def.rate) : 16);
    }
  }, [purchaseType, vatRates, initialData]);

  const yy = useMemo(() => year2FromDateISO(documentDate), [documentDate]);

  useEffect(() => {
    const loadNextInvoiceNoPreview = async () => {
      if (invoiceNoDirty) return;
      if (loadingInvoiceRef.current) return;

      // edit modda mevcut kayıt numarası korunur
      if (
        initialData &&
        (initialData.invoiceNo || initialData.documentNo || initialData.draftNo)
      ) {
        return;
      }

      loadingInvoiceRef.current = true;

      try {
        if (status === "completed") {
          const ref = doc(db, "invoice_counters", "purchases");
          const snap = await getDoc(ref);

          const data = snap.exists() ? snap.data() : {};
          const key = purchaseType === "official" ? "official" : "actual";

          const years =
            (data && typeof data === "object" ? data.years : null) || {};
          const yearMap =
            (years && typeof years === "object" ? years[yy] : null) || {};

          const currentSeq = Number((yearMap && yearMap[key]) ?? data[key] ?? 0);
          const nextSeq = currentSeq + 1;

          setInvoiceNo(formatInvoiceNo(purchaseType, yy, nextSeq));
        } else {
          const ref = doc(db, "draft_counters", "purchases");
          const snap = await getDoc(ref);

          const data = snap.exists() ? snap.data() : {};
          const years =
            (data && typeof data === "object" ? data.years : null) || {};
          const yearMap =
            (years && typeof years === "object" ? years[yy] : null) || {};

          const currentSeq = Number((yearMap && yearMap.seq) ?? 0);
          const nextSeq = currentSeq + 1;

          setInvoiceNo(formatDraftNo(yy, nextSeq));
        }
      } catch (e) {
        console.error("Fatura No Yükleme Hatası:", e);
        setInvoiceNo("");
      } finally {
        loadingInvoiceRef.current = false;
      }
    };

    loadNextInvoiceNoPreview();
  }, [purchaseType, yy, invoiceNoDirty, status, initialData]);

  /* ===============================
     TOPLAMLAR
  ================================ */

  const effectiveVatRate =
    purchaseType === "official" ? Number(selectedVat || 0) : 0;

  const totals = useMemo(() => {
    const net = items.reduce((s, i) => s + (i.netLineTotal || i.net || 0), 0);
    const vat = items.reduce((s, i) => s + (i.vatLineTotal || i.vat || 0), 0);
    const gross = items.reduce(
      (s, i) => s + (i.grossLineTotal || i.total || 0),
      0
    );

    const r = (x) => Math.round((Number(x) || 0) * 100) / 100;
    return { net: r(net), vat: r(vat), gross: r(gross) };
  }, [items]);

  /* ===============================
     ATTACHMENTS (METADATA)
  ================================ */

  const addAttachments = (fileList) => {
    const files = Array.from(fileList || []);
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    const maxBytes = 5 * 1024 * 1024;

    const cleaned = files
      .filter((f) => allowed.includes(f.type))
      .filter((f) => f.size <= maxBytes)
      .slice(0, 5)
      .map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        addedAt: new Date().toISOString(),
      }));

    setAttachments((prev) => {
      const merged = [...prev, ...cleaned];
      return merged.slice(0, 5);
    });
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ===============================
     SUBMIT
  ================================ */

  const showVatControls = purchaseType === "official";
  const hideVatColumns = purchaseType === "actual";

  const buildPayload = (nextStatus) => {
    return {
      purchaseId: purchaseId || initialData?.id || initialData?.purchaseId || null,
      id: purchaseId || initialData?.id || initialData?.purchaseId || null,

      status: nextStatus,

      supplierName: (supplierName || "").trim(),
      supplierCariId: supplierCariId || null,
      supplierBin: (supplierBin || "").trim(),
      supplierRef: (supplierRef || "").trim(),
      responsiblePerson: (responsiblePerson || "").trim(),

      invoiceNo: (invoiceNo || "").trim(),
      invoiceNoAuto: !invoiceNoDirty,

      documentDate,
      purchaseType,
      warehouseKey,

      vatMode,
      taxRate: effectiveVatRate,

      items,
      totals: {
        net: totals.net,
        tax: totals.vat,
        gross: totals.gross,
      },

      paymentMethod,
      payment: {
        method: paymentMethod,
        isPaid: Boolean(isPaid),
        paidDate: isPaid ? paidDate || documentDate || null : null,
      },
      dueDate: dueDate || null,
      notes,
      attachments,
    };
  };

  const validate = (nextStatus) => {
    if (nextStatus === "draft" || nextStatus === "pending") {
      if (!supplierName && !supplierCariId && items.length === 0) {
        alert("Taslak için en az bir alan doldurun (tedarikçi veya satır ekleyin).");
        return false;
      }
      return true;
    }

    if (!supplierName || !documentDate || !warehouseKey || items.length === 0) {
      alert("Lütfen gerekli alanları doldurun: Tedarikçi, Depo, Tarih, Satır öğeleri.");
      return false;
    }
    return true;
  };

  const handleAction = async (nextStatus) => {
    if (!validate(nextStatus)) return;
    const payload = buildPayload(nextStatus);
    await onSubmit(payload);
  };

  const handleDeleteDraft = async () => {
    if (!purchaseId && !initialData?.id && !initialData?.purchaseId) {
      alert("Silinecek kayıt bulunamadı.");
      return;
    }

    if (status === "completed") {
      alert("Tamamlanmış satınalma taslak olarak silinemez.");
      return;
    }

    if (!onDeleteDraft) {
      alert("Taslak silme işlemi bu sayfada bağlı değil.");
      return;
    }

    const ok = confirm("Bu taslağı silmek istediğine emin misin?");
    if (!ok) return;

    await onDeleteDraft({
      purchaseId: purchaseId || initialData?.id || initialData?.purchaseId,
    });
  };

  /* ===============================
     UI
  ================================ */

  const statusBadge =
    status === "completed"
      ? "Onaylandı"
      : status === "pending"
      ? "Onay Bekliyor"
      : isEditMode
      ? "Kaydedilmiş Taslak"
      : "Kaydedilmemiş Taslak";

  const paymentLabel =
    paymentMethod === "cash"
      ? "Nakit"
      : paymentMethod === "kaspi"
      ? "Kaspi QR/Biz"
      : "Banka Transferi";

  const titleText = isEditMode
    ? "Satınalma Kaydını Düzenle"
    : "Yeni Satınalma Faturası";

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-wider">
          <span className="hover:text-[#135bec]">SATINALMA</span>
          <span className="text-slate-300">›</span>
          <span className="text-slate-900">
            {isEditMode ? "KAYIT DÜZENLE" : "YENİ SATINALMA FATURASI"}
          </span>
        </div>

        <div className="flex justify-between items-end mt-2">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              {titleText}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-slate-500">
                Belge No:{" "}
                <span className="font-mono text-[#135bec]">
                  {invoiceNo || "-"}
                </span>
              </span>
              <span
                className={
                  status === "completed"
                    ? "bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                    : status === "pending"
                    ? "bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                    : "bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                }
              >
                {statusBadge}
              </span>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
              title="PDF Yazdır"
            >
              <FileText size={18} />
              PDF Yazdır
            </button>

            <button
              type="button"
              onClick={() => handleAction("completed")}
              className="flex items-center gap-2 px-6 py-2 bg-[#135bec] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
              title="Onayla ve Stoka Al"
            >
              <CheckCircle2 size={18} />
              Onayla ve Stoka Al
            </button>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-12 gap-6">
        {/* SOL */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">
          {/* DURUM + TÜR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* FATURA DURUMU */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-tight">
                Fatura Durumu
              </h3>

              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("draft");
                    if (!isEditMode) setInvoiceNoDirty(false);
                  }}
                  className={
                    status === "draft"
                      ? "flex-1 py-2 text-xs font-bold rounded-md bg-white shadow-sm text-[#135bec]"
                      : "flex-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                  }
                >
                  Taslak
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("pending");
                    if (!isEditMode) setInvoiceNoDirty(false);
                  }}
                  className={
                    status === "pending"
                      ? "flex-1 py-2 text-xs font-bold rounded-md bg-white shadow-sm text-[#135bec]"
                      : "flex-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                  }
                >
                  Onay Bekliyor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("completed");
                    if (!isEditMode) setInvoiceNoDirty(false);
                  }}
                  className={
                    status === "completed"
                      ? "flex-1 py-2 text-xs font-bold rounded-md bg-white shadow-sm text-[#135bec]"
                      : "flex-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                  }
                >
                  Onaylandı
                </button>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                <b>Taslak</b> ve <b>Onay Bekliyor</b> kayıtları stok, ortalama maliyet ve cari
                hareketi yazmaz. Sadece <b>Onayla ve Stoka Al</b> final kayıt üretir.
              </p>
            </div>

            {/* ALIM SINIFLANDIRMASI */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-tight">
                Alım Sınıflandırması
              </h3>
              <div className="flex gap-4">
                <label className="flex-1 flex items-center gap-3 p-3 border-2 border-[#135bec] bg-blue-50 rounded-lg cursor-pointer">
                  <input
                    className="text-[#135bec] focus:ring-[#135bec]"
                    name="type"
                    type="radio"
                    checked={purchaseType === "official"}
                    onChange={() => setPurchaseType("official")}
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-none">
                      Resmi (Standart)
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">KDV Aktif</p>
                  </div>
                </label>

                <label className="flex-1 flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    className="text-[#135bec] focus:ring-[#135bec]"
                    name="type"
                    type="radio"
                    checked={purchaseType === "actual"}
                    onChange={() => setPurchaseType("actual")}
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-none">
                      Fiili (Doğrudan)
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      KDV Devre Dışı
                    </p>
                  </div>
                </label>
              </div>

              {showVatControls && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">
                      KDV Tipi
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-[#135bec]"
                      value={vatMode}
                      onChange={(e) => setVatMode(e.target.value)}
                    >
                      <option value="inclusive">Dahil</option>
                      <option value="exclusive">Hariç</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">
                      KDV Oranı
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-[#135bec]"
                      value={selectedVat}
                      onChange={(e) => setSelectedVat(Number(e.target.value))}
                    >
                      {vatRates.map((v, i) => (
                        <option key={i} value={v.rate}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TEDARİKÇİ & LOJİSTİK */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-[#135bec]">
              <Building2 size={20} />
              <h2 className="text-lg font-bold text-slate-900">
                Tedarikçi ve Lojistik
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tedarikçi (Cari) */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-bold text-slate-500">
                  Tedarikçi Adı (Cari)
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-[#135bec]"
                    placeholder="Firma / BIN / Telefon ile ara..."
                    value={cariSearch}
                    onFocus={() => setCariOpen(true)}
                    onBlur={() => setTimeout(() => setCariOpen(false), 150)}
                    onChange={(e) => {
                      setCariSearch(e.target.value);
                      setCariOpen(true);
                      if (supplierCariId) setSupplierCariId(null);
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <ChevronDown size={18} />
                  </span>
                </div>

                {cariOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 w-full z-50 max-h-64 overflow-y-auto rounded-lg shadow-lg">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500">
                        Cari Listesi
                      </span>
                      <button
                        type="button"
                        className="text-[11px] font-bold text-slate-500 hover:text-[#135bec]"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          clearCari();
                        }}
                      >
                        Temizle
                      </button>
                    </div>
                    {filteredCaris.map((c) => (
                      <div
                        key={c.id}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectCari(c);
                        }}
                      >
                        <div className="font-medium text-sm">{c.firm || "-"}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.bin ? `BIN: ${c.bin}` : "BIN: -"}{" "}
                          {c.mobile ? `• Tel: ${c.mobile}` : ""}
                        </div>
                      </div>
                    ))}
                    {!filteredCaris.length && (
                      <div className="px-3 py-3 text-[11px] text-slate-500">
                        Kayıt bulunamadı.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BIN */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">
                  BIN / Vergi No
                </label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-mono focus:ring-[#135bec]"
                  placeholder="12 haneli numara"
                  value={supplierBin}
                  onChange={(e) => setSupplierBin(e.target.value)}
                />
              </div>

              {/* Depo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">
                  Depo Girişi
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-[#135bec]"
                  value={warehouseKey}
                  onChange={(e) => setWarehouseKey(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.key} value={w.key}>
                      {w.label} ({w.key})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tarih */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">
                  Fatura Tarihi
                </label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-[#135bec]"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                />
              </div>

              {/* Tedarikçi Referansı */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">
                  Tedarikçi Referansı
                </label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-[#135bec]"
                  placeholder="Örn: INV-12345"
                  value={supplierRef}
                  onChange={(e) => setSupplierRef(e.target.value)}
                />
              </div>

              {/* Sorumlu */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">
                  Sorumlu Kişi
                </label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-[#135bec]"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  placeholder="Örn: Hasan"
                />
              </div>

              {/* Fatura No (manuel/oto) */}
              <div className="flex flex-col gap-1.5 md:col-span-3">
                <label className="text-xs font-bold text-slate-500">
                  Belge No
                </label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-mono focus:ring-[#135bec]"
                  value={invoiceNo}
                  onChange={(e) => {
                    setInvoiceNo(e.target.value);
                    setInvoiceNoDirty(true);
                  }}
                  placeholder="Otomatik numara..."
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Inputa dokunmazsan seçtiğin duruma göre sayaçtan otomatik numara kullanılır.
                </p>
              </div>

              {/* Tedarikçi manuel adı (opsiyonel) */}
              <div className="flex flex-col gap-1.5 md:col-span-3">
                <label className="text-xs font-bold text-slate-500">
                  Tedarikçi (Manuel)
                </label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-[#135bec]"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Cari seçmeden manuel yazabilirsin"
                />
              </div>
            </div>
          </div>

          {/* SATIR ÖĞELERİ */}
          <PurchaseItemsTable
            onChange={setItems}
            vatRate={effectiveVatRate}
            vatMode={vatMode}
            hideVat={hideVatColumns}
            initialItems={items}
          />

          {/* ÖDEME + NOT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-tight">
                Ödeme ve Şartlar
              </h3>

              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">
                    Ödeme Yöntemi
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("bank")}
                      className={
                        paymentMethod === "bank"
                          ? "py-2 px-1 text-[10px] font-bold border-2 border-[#135bec] bg-blue-50 rounded-lg text-[#135bec]"
                          : "py-2 px-1 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
                      }
                    >
                      Banka Transferi
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={
                        paymentMethod === "cash"
                          ? "py-2 px-1 text-[10px] font-bold border-2 border-[#135bec] bg-blue-50 rounded-lg text-[#135bec]"
                          : "py-2 px-1 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
                      }
                    >
                      Nakit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("kaspi")}
                      className={
                        paymentMethod === "kaspi"
                          ? "py-2 px-1 text-[10px] font-bold border-2 border-[#135bec] bg-blue-50 rounded-lg text-[#135bec]"
                          : "py-2 px-1 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
                      }
                    >
                      Kaspi QR/Biz
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">
                    Ödeme Durumu
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPaid(false)}
                      className={
                        !isPaid
                          ? "py-2 px-2 text-[10px] font-bold border-2 border-[#135bec] bg-blue-50 rounded-lg text-[#135bec]"
                          : "py-2 px-2 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
                      }
                      title="Bu fatura için ödeme yapılmadı"
                    >
                      Ödenmedi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaid(true);
                        if (!paidDate) setPaidDate(documentDate || "");
                      }}
                      className={
                        isPaid
                          ? "py-2 px-2 text-[10px] font-bold border-2 border-emerald-600 bg-emerald-50 rounded-lg text-emerald-700"
                          : "py-2 px-2 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
                      }
                      title="Bu fatura için ödeme yapıldı"
                    >
                      Ödendi
                    </button>
                  </div>

                  {isPaid && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">
                        Ödeme Tarihi
                      </label>
                      <input
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-4 text-sm"
                        type="date"
                        value={paidDate}
                        onChange={(e) => setPaidDate(e.target.value)}
                      />
                      <p className="text-[10px] text-slate-400">
                        Not: <b>Onayla ve Stoka Al</b> ile birlikte cari hareketine “ödendi” işlenir.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">
                    Son Ödeme Tarihi
                  </label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-4 text-sm"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-tight">
                Notlar ve Ekler
              </h3>

              <textarea
                className="flex-grow w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-[#135bec] h-24 resize-none mb-3"
                placeholder="Dahili açıklamalar, lojistik talimatları..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-[11px] font-bold text-slate-500 hover:border-[#135bec] hover:text-[#135bec] transition-all cursor-pointer">
                  <Paperclip size={16} />
                  Dosya Ekle (Maks 5MB)
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/png,image/jpeg"
                    multiple
                    onChange={(e) => {
                      addAttachments(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-[10px] text-slate-400">
                  Sadece PDF, JPG, PNG
                </span>
              </div>

              {!!attachments.length && (
                <div className="mt-3 space-y-2">
                  {attachments.map((a, idx) => (
                    <div
                      key={`${a.name}-${idx}`}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-700 truncate">
                          {a.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {(a.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-bold text-red-600 hover:underline"
                        onClick={() => removeAttachment(idx)}
                      >
                        Kaldır
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SAĞ */}
        <div className="col-span-12 lg:col-span-3">
          <div className="sticky top-8 flex flex-col gap-6">
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl shadow-slate-900/10">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                Finansal Özet
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-medium">Ara Toplam</span>
                  <span className="font-mono">{fmtMoney(totals.net)} ₸</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-medium">
                    KDV (%{effectiveVatRate})
                  </span>
                  <span className="font-mono text-emerald-400">
                    +{fmtMoney(totals.vat)} ₸
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-medium">İndirim</span>
                  <span className="font-mono text-red-400">
                    -{fmtMoney(0)} ₸
                  </span>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                    Genel Toplam
                  </p>
                  <div className="flex justify-between items-baseline">
                    <span className="text-3xl font-black text-white">
                      {new Intl.NumberFormat("tr-TR", {
                        maximumFractionDigits: 0,
                      }).format(Number(totals.gross || 0))}
                    </span>
                    <span className="text-xl font-bold text-slate-400 ml-1">
                      ₸
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => handleAction("draft")}
                  className="w-full py-4 bg-[#135bec] hover:bg-blue-700 rounded-xl font-black text-sm tracking-tight transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  TASLAĞI KAYDET
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("pending")}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 rounded-xl font-black text-xs tracking-tight transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Clock3 size={16} />
                  ONAY BEKLİYOR OLARAK KAYDET
                </button>

                {status !== "completed" && isEditMode && !!onDeleteDraft && (
                  <button
                    type="button"
                    onClick={handleDeleteDraft}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs tracking-tight transition-all border border-red-500 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    TASLAĞI SİL
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm("Bu faturayı temizlemek istiyor musun? Kaydedilmemiş alanlar kaybolur.")
                    ) {
                      setSupplierCariId(null);
                      setSupplierName("");
                      setSupplierBin("");
                      setSupplierRef("");
                      setResponsiblePerson("");
                      setCariSearch("");
                      setItems([]);
                      setNotes("");
                      setAttachments([]);
                      setDueDate("");
                      setPaymentMethod("bank");
                      setIsPaid(false);
                      setPaidDate("");
                      setStatus("draft");
                      setInvoiceNoDirty(false);

                      if (!isEditMode) {
                        setInvoiceNo("");
                      }
                    }
                  }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs tracking-tight transition-all border border-slate-700"
                >
                  FORMU TEMİZLE
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">
                Hızlı Görüşler
              </h3>
              <div className="flex flex-col gap-4">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 font-black uppercase">
                    Ödeme
                  </p>
                  <p className="text-xs text-emerald-800 font-medium mt-1">
                    Yöntem: <b>{paymentLabel}</b>
                    {dueDate ? ` • Vade: ${dueDate}` : ""}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-[10px] text-blue-600 font-black uppercase">
                    Satır Özeti
                  </p>
                  <p className="text-xs text-blue-800 font-medium mt-1">
                    {items.length} satır • Depo: <b>{warehouseKey}</b>
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] text-slate-500 font-black uppercase">
                    Belge Tipi
                  </p>
                  <p className="text-xs text-slate-700 font-medium mt-1">
                    {isDraftLike ? "Draft / Pending numarası" : "Final fatura numarası"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}