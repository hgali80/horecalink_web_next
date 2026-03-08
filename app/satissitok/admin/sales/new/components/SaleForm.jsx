// app/satissitok/admin/sales/new/components/SaleForm.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Calendar,
  ClipboardList,
  FileDown,
  Save,
  Send,
  Truck,
  Wallet,
  AlertTriangle,
} from "lucide-react";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

import SaleItemsTable from "./SaleItemsTable";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDefaultKey(list, fallback) {
  const active = (list || []).filter((x) => x?.active !== false);
  const def = active.find((x) => x?.default === true);
  return (def?.key || active[0]?.key || fallback || "").trim();
}

function getDefaultVatRate(vats) {
  const active = (vats || []).filter((x) => x?.active !== false);
  const def = active.find((x) => x?.default === true);
  const rate = Number(def?.rate ?? active[0]?.rate ?? 0);
  return Number.isFinite(rate) ? rate : 0;
}

/* ===============================
   FATURA NO ÖNİZLEME (SATIŞ)
   - invoice_counters/sales years[YY][official|actual]
   - invoiceNoDirty değilse otomatik önizleme gösterir
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

// SR-26-000001 / SF-26-000001
function formatSaleInvoiceNo(type, yy, seq, isDraft = false) {
  const prefix = isDraft ? "SD" : type === "official" ? "SR" : "SF";
  return `${prefix}-${yy}-${pad6(seq)}`;
}

export default function SaleForm({
  products,
  caris,
  balances,
  settings,
  onSubmit,
  disabled,
  initialData = null,
  onDeleteDraft = null,
}) {
  const units = useMemo(() => settings?.units || [], [settings]);
  const warehouses = useMemo(() => settings?.warehouses || [], [settings]);
  const platforms = useMemo(() => settings?.platforms || [], [settings]);
  const vatRates = useMemo(() => settings?.taxes?.vat || [], [settings]);

  const defaultUnit = useMemo(() => getDefaultKey(units, "adet"), [units]);
  const defaultWarehouse = useMemo(
    () => getDefaultKey(warehouses, "main"),
    [warehouses]
  );
  const defaultPlatform = useMemo(
    () => getDefaultKey(platforms, "showroom"),
    [platforms]
  );
  const defaultVatRate = useMemo(() => getDefaultVatRate(vatRates), [vatRates]);

  const [draftInfo, setDraftInfo] = useState(null);

  // Header-ish
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [processStatus, setProcessStatus] = useState("draft");

  // Sale meta
  const [saleType, setSaleType] = useState("actual"); // official | actual
  const [saleChannel, setSaleChannel] = useState(defaultPlatform);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceNoDirty, setInvoiceNoDirty] = useState(false);
  const loadingInvoiceRef = useRef(false);
  const [vatMode, setVatMode] = useState("exclude"); // exclude | include

  // Customer
  const [cariSearch, setCariSearch] = useState("");
  const [cariId, setCariId] = useState("");
  const selectedCari = useMemo(
    () => caris?.find((c) => c.id === cariId) || null,
    [caris, cariId]
  );

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [paidAmount, setPaidAmount] = useState(0);
  // ✅ yeni: tahsilat durumu (cariye işlenecek)
  const [isPaid, setIsPaid] = useState(false);

  // Logistics + notes
  const [deliveryMode, setDeliveryMode] = useState("pickup");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [loadingArea, setLoadingArea] = useState("Ana Terminal Peron 02");
  const [customerNote, setCustomerNote] = useState("");
  const [internalNote, setInternalNote] = useState("");

  // Items
  const [items, setItems] = useState(() => [
    {
      productId: "",
      productName: "",
      unit: defaultUnit,
      warehouseKey: defaultWarehouse,
      quantity: 1,
      unitPrice: 0,
      discountRate: 0,
      vatRate: defaultVatRate,
      net: 0,
      vat: 0,
      total: 0,
    },
  ]);


  useEffect(() => {
    if (!initialData) return;
    setDraftInfo({ savedAt: Date.now() });
    const dt = initialData.invoiceDate?.toDate ? initialData.invoiceDate.toDate() : initialData.invoiceDate ? new Date(initialData.invoiceDate) : null;
    if (dt && !Number.isNaN(dt.getTime())) setInvoiceDate(dt.toISOString().slice(0, 10));
    const due = initialData.dueDate?.toDate ? initialData.dueDate.toDate() : initialData.dueDate ? new Date(initialData.dueDate) : null;
    setDueDate(due && !Number.isNaN(due.getTime()) ? due.toISOString().slice(0,10) : "");
    setProcessStatus(initialData.status || "draft");
    setSaleType(initialData.saleType || "actual");
    setSaleChannel(initialData.saleChannel || initialData.platformId || defaultPlatform);
    setVatMode(initialData.vatMode || "exclude");
    setInvoiceNo(initialData.invoiceNo || initialData.draftNo || "");
    setInvoiceNoDirty(false);
    setCariId(initialData.cariId || "");
    setPaymentMethod(initialData.payment?.method || "bank");
    setPaidAmount(Number(initialData.payment?.paidAmount || 0));
    setIsPaid(Boolean(initialData.payment?.isPaid));
    setDeliveryMode(initialData.meta?.delivery?.mode || "pickup");
    setDeliveryDate(initialData.meta?.delivery?.deliveryDate || "");
    setPlateNo(initialData.meta?.delivery?.plateNo || "");
    setLoadingArea(initialData.meta?.delivery?.loadingArea || "Ana Terminal Peron 02");
    setCustomerNote(initialData.meta?.notes?.customer || "");
    setInternalNote(initialData.meta?.notes?.internal || "");
    const loadedItems = Array.isArray(initialData.draftItems) ? initialData.draftItems : [];
    if (loadedItems.length) setItems(loadedItems);
  }, [initialData, defaultPlatform]);

  // When settings arrives, fix defaults for the empty first render
  useEffect(() => {
    setItems((prev) =>
      prev.map((r) => ({
        ...r,
        unit: r.unit || defaultUnit,
        warehouseKey: r.warehouseKey || defaultWarehouse,
        vatRate:
          Number.isFinite(Number(r.vatRate)) && Number(r.vatRate) >= 0
            ? Number(r.vatRate)
            : defaultVatRate,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUnit, defaultWarehouse, defaultVatRate]);

  const cariOptions = useMemo(() => {
    const q = (cariSearch || "").toLowerCase().trim();
    const list = Array.isArray(caris) ? caris : [];
    if (!q) return list.slice(0, 15);
    return list
      .filter((c) => {
        const f = (c?.firm || "").toLowerCase();
        const b = (c?.bin || "").toLowerCase();
        const m = (c?.mobile || "").toLowerCase();
        return f.includes(q) || b.includes(q) || m.includes(q);
      })
      .slice(0, 15);
  }, [caris, cariSearch]);

  function calcLine(row) {
    const qty = Number(row.quantity || 0) || 0;
    const unitPrice = Number(row.unitPrice || 0) || 0;
    const discountRate = Number(row.discountRate || 0) || 0;

    const gross = qty * unitPrice;
    const discount = (gross * discountRate) / 100;
    const afterDiscount = gross - discount;

    const vatDisabledLocal = saleType !== "official";
    const vatRate = vatDisabledLocal ? 0 : Number(row.vatRate || 0) || 0;

    let net = afterDiscount;
    let vat = 0;
    let total = afterDiscount;

    if (!vatDisabledLocal) {
      if (vatMode === "include") {
        const factor = 1 + vatRate / 100;
        net = afterDiscount / factor;
        vat = afterDiscount - net;
        total = afterDiscount;
      } else {
        vat = (afterDiscount * vatRate) / 100;
        total = afterDiscount + vat;
        net = afterDiscount;
      }
    }

    row.net = Math.round(net * 100) / 100;
    row.vat = Math.round(vat * 100) / 100;
    row.total = Math.round(total * 100) / 100;
  }

  const totals = useMemo(() => {
    const net = items.reduce((s, r) => s + (Number(r.net) || 0), 0);
    const vat = items.reduce((s, r) => s + (Number(r.vat) || 0), 0);
    const total = items.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const discount = items.reduce((s, r) => {
      const qty = Number(r.quantity || 0);
      const up = Number(r.unitPrice || 0);
      const dr = Number(r.discountRate || 0);
      if (qty <= 0 || up <= 0 || dr <= 0) return s;
      const line = qty * up;
      return s + (line * dr) / 100;
    }, 0);
    return {
      net: Math.round(net * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: Math.round(total * 100) / 100,
      discount: Math.round(discount * 100) / 100,
    };
  }, [items]);

  const remaining = useMemo(() => {
    const paid = Number(paidAmount || 0) || 0;
    return Math.round((totals.total - paid) * 100) / 100;
  }, [totals.total, paidAmount]);

  const vatDisabled = saleType !== "official";

  // ✅ Satınalma ile aynı mantık: önizleme göster
  const yy = useMemo(() => year2FromDateISO(invoiceDate), [invoiceDate]);

  useEffect(() => {
    const loadPreview = async () => {
      if (invoiceNoDirty) return;
      if (loadingInvoiceRef.current) return;
      loadingInvoiceRef.current = true;

      try {
        const ref = doc(db, "invoice_counters", "sales");
        const snap = await getDoc(ref);

        const data = snap.exists() ? snap.data() : {};
        const years = (data && typeof data === "object" ? data.years : null) || {};
        const yearMap =
          (years && typeof years === "object" ? years[yy] : null) || {};

        const currentSeq = Number(
          (yearMap && yearMap[saleType]) ?? data[saleType] ?? 0
        );
        const nextSeq = currentSeq + 1;

        setInvoiceNo(formatSaleInvoiceNo(saleType, yy, nextSeq, processStatus !== "completed"));
      } catch (e) {
        console.error("SALE invoice preview error:", e);
        setInvoiceNo("");
      } finally {
        loadingInvoiceRef.current = false;
      }
    };

    loadPreview();
  }, [saleType, yy, invoiceNoDirty, processStatus]);

  const negativeStockWarnings = useMemo(() => {
    if (!balances) return [];
    const bucketKey = saleType === "official" ? "official" : "actual";
    const warnings = [];

    for (const r of items) {
      if (!r?.productId) continue;
      const whKey = (r.warehouseKey || defaultWarehouse).trim() || defaultWarehouse;

      const docData = balances?.[r.productId] || {};
      const wh = docData?.warehouses?.[whKey]?.[bucketKey];
      const legacy = docData?.[bucketKey];

      const qty = Number(wh?.qty ?? legacy?.qty ?? 0) || 0;
      const need = Number(r.quantity || 0) || 0;
      if (need > 0 && qty < need) {
        warnings.push({
          productId: r.productId,
          productName: r.productName || "",
          warehouseKey: whKey,
          available: qty,
          need,
        });
      }
    }

    return warnings;
  }, [balances, items, saleType, defaultWarehouse]);

  async function clearDraft() {
    if (typeof onDeleteDraft === "function") {
      await onDeleteDraft();
    }
  }

  async function submit(mode) {
    // satır hesaplarını garanti altına al
    const fixedItems = (Array.isArray(items) ? [...items] : []).map((r) => {
      const row = { ...r };
      calcLine(row);
      return row;
    });
    setItems(fixedItems);

    const payload = {
      invoiceDate,
      dueDate: dueDate || null,
      saleId: initialData?.id || null,
      status: mode === "draft" ? "draft" : processStatus,
      processStatus,
      saleType,
      saleChannel,
      vatMode,
      invoiceNo: invoiceNo?.trim() || "",
      invoiceNoDirty: Boolean(invoiceNoDirty && invoiceNo?.trim()),
      cariId: cariId || null,
      payment: {
        method: paymentMethod,
        paidAmount: Number(paidAmount || 0) || 0,
        isPaid: Boolean(isPaid),
      },
      meta: {
        delivery: {
          mode: deliveryMode,
          deliveryDate: deliveryDate || null,
          plateNo: plateNo || null,
          loadingArea: loadingArea || null,
        },
        notes: {
          customer: customerNote || "",
          internal: internalNote || "",
        },
      },
      items: fixedItems,
      totals,
    };

    await onSubmit(payload);
  }

  return (
    <div className="bg-slate-50 min-h-[70vh]">
      <div className="max-w-[1600px] mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <Wallet size={22} />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900 leading-none">
                    Satış Faturası Oluştur
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      Taslak
                    </span>
                    <span className="text-slate-300">|</span>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                      Fatura No:{" "}
                      <span className="text-slate-900">
                        {invoiceNo?.trim() ? invoiceNo : "Otomatik"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Fatura Tarihi
                  </label>
                  <div className="relative">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={16}
                    />
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="pl-9 h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Vade Tarihi
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none px-3"
                    disabled={disabled}
                  />
                </div>

                <div className="flex flex-col min-w-[160px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Süreç Durumu
                  </label>
                  <select
                    value={processStatus}
                    onChange={(e) => setProcessStatus(e.target.value)}
                    className="h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none px-3"
                    disabled={disabled}
                  >
                    <option value="draft">Taslak</option>
                    <option value="pending">Onay Bekliyor</option>
                    <option value="completed">Onaylandı</option>
                  </select>
                </div>
              </div>
            </div>

            {initialData?.id && draftInfo?.savedAt && (
              <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-bold">Taslak yüklendi.</span>
                  <span className="ml-2 text-blue-700 text-xs">
                    (Kaydedilme:{" "}
                    {new Date(draftInfo.savedAt).toLocaleString("tr-TR")})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearDraft}
                  className="px-3 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100"
                  disabled={disabled}
                >
                  Taslağı Sil
                </button>
              </div>
            )}

            {negativeStockWarnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3">
                <AlertTriangle className="mt-0.5" size={18} />
                <div className="text-sm">
                  <div className="font-bold">Negatif stok uyarısı</div>
                  <div className="text-xs text-amber-800 mt-1">
                    {negativeStockWarnings.slice(0, 3).map((w) => (
                      <div key={`${w.productId}_${w.warehouseKey}`}>
                        {w.productName || w.productId} ({w.warehouseKey}) – stok:{" "}
                        {w.available}, istenen: {w.need}
                      </div>
                    ))}
                    {negativeStockWarnings.length > 3 && (
                      <div>+{negativeStockWarnings.length - 3} satır daha</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Customer */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="text-blue-700" size={18} />
                <h3 className="font-bold text-slate-900">Müşteri Bilgileri</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <input
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Şirket Adı / BIN / Telefon ara..."
                    value={cariSearch}
                    onChange={(e) => setCariSearch(e.target.value)}
                    disabled={disabled}
                  />

                  <select
                    className="w-full border border-slate-200 bg-white rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={cariId}
                    onChange={(e) => setCariId(e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Müşteri seç…</option>
                    {cariOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firm || "-"} {c.bin ? `(${c.bin})` : ""}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      className="border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                      placeholder="BIN"
                      value={selectedCari?.bin || ""}
                      readOnly
                    />
                    <input
                      className="border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                      placeholder="Telefon"
                      value={selectedCari?.mobile || ""}
                      readOnly
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Fatura No (Opsiyonel)
                    </label>
                    <input
                      className="border border-slate-200 bg-white rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Boş bırakırsan sistem üretir. Elle yazarsan manuel kaydeder (sayaç yine artar)."
                      value={invoiceNo}
                      onChange={(e) => {
                        setInvoiceNo(e.target.value);
                        setInvoiceNoDirty(Boolean(e.target.value.trim()));
                      }}
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <textarea
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                    placeholder="Adres"
                    rows={5}
                    value={selectedCari?.legalAddress || ""}
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Sale type + Platform */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BadgeCheck className="text-blue-700" size={18} />
                  <h3 className="font-bold text-slate-900">Satış Tipi</h3>
                </div>
                <div className="flex gap-3">
                  <label
                    className={`flex-1 p-3 rounded-2xl border-2 cursor-pointer ${
                      saleType === "official"
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      className="mr-2"
                      name="saleType"
                      checked={saleType === "official"}
                      onChange={() => setSaleType("official")}
                      disabled={disabled}
                    />
                    <div>
                      <div className="text-sm font-bold">Resmi Satış</div>
                      <div className="text-[10px] text-slate-500">
                        Yasal fatura + KDV
                      </div>
                    </div>
                  </label>
                  <label
                    className={`flex-1 p-3 rounded-2xl border-2 cursor-pointer ${
                      saleType === "actual"
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      className="mr-2"
                      name="saleType"
                      checked={saleType === "actual"}
                      onChange={() => setSaleType("actual")}
                      disabled={disabled}
                    />
                    <div>
                      <div className="text-sm font-bold">Fiili Satış</div>
                      <div className="text-[10px] text-slate-500">
                        Dahili satış + KDV pasif
                      </div>
                    </div>
                  </label>
                </div>

                <div className="mt-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    KDV Modu
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setVatMode("exclude")}
                      className={`flex-1 h-10 rounded-xl border text-sm font-bold ${
                        vatMode === "exclude"
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600"
                      } ${vatDisabled ? "opacity-50 pointer-events-none" : ""}`}
                      disabled={disabled}
                    >
                      Hariç
                    </button>
                    <button
                      type="button"
                      onClick={() => setVatMode("include")}
                      className={`flex-1 h-10 rounded-xl border text-sm font-bold ${
                        vatMode === "include"
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600"
                      } ${vatDisabled ? "opacity-50 pointer-events-none" : ""}`}
                      disabled={disabled}
                    >
                      Dahil
                    </button>
                  </div>
                  {vatDisabled && (
                    <div className="text-[11px] text-slate-500 mt-2">
                      Fiili satışta KDV pasif.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="text-blue-700" size={18} />
                  <h3 className="font-bold text-slate-900">Satış Platformu</h3>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(platforms || [])
                    .filter((p) => p?.active !== false)
                    .map((p) => (
                      <button
                        type="button"
                        key={p.key}
                        onClick={() => setSaleChannel(p.key)}
                        className={`px-4 h-10 rounded-xl border text-sm font-bold transition ${
                          saleChannel === p.key
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        disabled={disabled}
                      >
                        {p.label || p.key}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Items (KIRMA!) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="text-blue-700" size={18} />
                  <h3 className="font-bold text-slate-900">Fatura Satırları</h3>
                </div>
                <div className="text-xs text-slate-500">Alt+N: satır ekle</div>
              </div>

              <SaleItemsTable
                products={products}
                balances={balances}
                items={items}
                setItems={setItems}
                saleType={saleType}
                vatMode={vatMode}
                units={units}
                warehouses={warehouses}
                vatRates={vatRates}
                defaultUnit={defaultUnit}
                defaultWarehouse={defaultWarehouse}
                defaultVatRate={defaultVatRate}
                disabled={disabled}
              />
            </div>

            {/* Logistics */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="text-blue-700" size={18} />
                <h3 className="font-bold text-slate-900">
                  Lojistik ve Teslimat
                </h3>
              </div>

              <div className="flex flex-wrap border-b border-slate-100">
                {[
                  ["pickup", "Gel Al"],
                  ["courier", "Kurye"],
                  ["cargo", "Kargo"],
                  ["customer", "Müşteri Nakliyesi"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDeliveryMode(k)}
                    className={`px-6 py-2 text-sm font-bold border-b-2 ${
                      deliveryMode === k
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                    disabled={disabled}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Teslim Tarihi
                  </label>
                  <input
                    className="mt-2 w-full border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Araç Plakası
                  </label>
                  <input
                    className="mt-2 w-full border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                    placeholder="Plaka No (Opsiyonel)"
                    value={plateNo}
                    onChange={(e) => setPlateNo(e.target.value)}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Yükleme Alanı
                  </label>
                  <select
                    className="mt-2 w-full border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                    value={loadingArea}
                    onChange={(e) => setLoadingArea(e.target.value)}
                    disabled={disabled}
                  >
                    <option>Ana Terminal Peron 02</option>
                    <option>Dökme Yük Sahası 14</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="text-blue-700" size={18} />
                  <h3 className="font-bold text-slate-900">Notlar</h3>
                </div>

                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Müşteri Notu
                </label>
                <textarea
                  className="mt-2 w-full min-h-[120px] border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  disabled={disabled}
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="text-blue-700" size={18} />
                  <h3 className="font-bold text-slate-900">İç Not</h3>
                </div>

                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  İç Not
                </label>
                <textarea
                  className="mt-2 w-full min-h-[120px] border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="bg-[#0b1220] text-white rounded-2xl shadow-sm p-6">
              <div className="text-[11px] uppercase tracking-widest text-slate-300 font-bold">
                Genel Toplam
              </div>
              <div className="mt-2 text-4xl font-extrabold">
                {fmtMoney(totals.total)} ₸
              </div>
              <div className="mt-2 text-xs text-slate-300">
                {vatDisabled ? "KDV Pasif" : "KDV Aktif"}
              </div>

              <div className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between text-slate-200">
                  <span>Ara Toplam</span>
                  <span className="font-bold">{fmtMoney(totals.net)} ₸</span>
                </div>
                <div className="flex justify-between text-slate-200">
                  <span>KDV Toplamı</span>
                  <span className="font-bold">
                    {fmtMoney(vatDisabled ? 0 : totals.vat)} ₸
                  </span>
                </div>
                <div className="flex justify-between text-slate-200">
                  <span>Toplam İndirim</span>
                  <span className="font-bold text-red-300">
                    -{fmtMoney(totals.discount)} ₸
                  </span>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4 space-y-3">
                <label className="text-[10px] font-bold text-slate-300 uppercase">
                  Ödeme Yöntemi
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-10 rounded-xl bg-white/10 border border-white/10 text-white px-3 text-sm font-bold outline-none"
                  disabled={disabled}
                >
                  <option value="bank">Banka Havalesi</option>
                  <option value="cash">Nakit</option>
                  <option value="kaspi">Kaspi</option>
                </select>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">
                    Tahsilat Durumu
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaid(false);
                        setPaidAmount(0);
                      }}
                      className={
                        !isPaid
                          ? "h-10 rounded-xl bg-white text-slate-900 font-extrabold"
                          : "h-10 rounded-xl bg-white/10 hover:bg-white/15 font-bold"
                      }
                      disabled={disabled}
                      title="Bu satış faturası için tahsilat alınmadı"
                    >
                      Alınmadı
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaid(true);
                        const t = Number(totals.total || 0) || 0;
                        const current = Number(paidAmount || 0) || 0;
                        if (current <= 0 && t > 0) setPaidAmount(t);
                      }}
                      className={
                        isPaid
                          ? "h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-extrabold"
                          : "h-10 rounded-xl bg-white/10 hover:bg-white/15 font-bold"
                      }
                      disabled={disabled}
                      title="Bu satış faturası için tahsilat alındı"
                    >
                      Alındı
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-300 uppercase">
                      Ödenen Tutar
                    </label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0) || 0;
                        const max = Number(totals.total || 0) || 0;
                        const clamped = Math.max(0, Math.min(v, max));
                        setPaidAmount(clamped);
                        setIsPaid(clamped > 0 && clamped >= max);
                      }}
                      className="w-full h-10 rounded-xl bg-white/10 border border-white/10 text-white px-3 text-sm font-bold outline-none"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-300 uppercase">
                      Kalan Bakiye
                    </label>
                    <div className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm font-extrabold flex items-center">
                      {fmtMoney(remaining)} ₸
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => submit("submit")}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-extrabold flex items-center justify-center gap-2 active:scale-95 transition"
                  disabled={disabled}
                >
                  <Send size={18} />
                  {processStatus === "completed" ? "Onayla ve Tamamla" : "Kaydet"}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => submit("draft")}
                    className="h-11 rounded-xl bg-white/10 hover:bg-white/15 font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                    disabled={disabled}
                  >
                    <Save size={18} />
                    Taslağı Kaydet
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-xl bg-white/10 hover:bg-white/15 font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                    disabled={disabled}
                    onClick={() => window.print()}
                  >
                    <FileDown size={18} />
                    Yazdır (PDF)
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="text-sm font-extrabold text-slate-900">
                Lojistik & Notlar
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Teslim Modu
                  </label>
                  <select
                    value={deliveryMode}
                    onChange={(e) => setDeliveryMode(e.target.value)}
                    className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold px-3 outline-none"
                    disabled={disabled}
                  >
                    <option value="pickup">Müşteri Alır</option>
                    <option value="delivery">Teslimat</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Teslim Tarihi
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold px-3 outline-none"
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Plaka
                  </label>
                  <input
                    value={plateNo}
                    onChange={(e) => setPlateNo(e.target.value)}
                    className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold px-3 outline-none"
                    placeholder="Örn: 700ABC02"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Yükleme Alanı
                  </label>
                  <input
                    value={loadingArea}
                    onChange={(e) => setLoadingArea(e.target.value)}
                    className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold px-3 outline-none"
                    disabled={disabled}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Müşteri Notu
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="w-full min-h-[70px] rounded-xl bg-slate-50 border border-slate-200 text-sm px-3 py-2 outline-none"
                  disabled={disabled}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  İç Not
                </label>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  className="w-full min-h-[70px] rounded-xl bg-slate-50 border border-slate-200 text-sm px-3 py-2 outline-none"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}