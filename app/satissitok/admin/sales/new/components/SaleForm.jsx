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
  Trash2,
  Clock3,
} from "lucide-react";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

import SaleItemsTable from "./SaleItemsTable";

const DRAFT_KEY = "satissitok_sale_draft_v1";

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
function formatSaleInvoiceNo(type, yy, seq) {
  const prefix = type === "official" ? "SR" : "SF";
  return `${prefix}-${yy}-${pad6(seq)}`;
}

// SD-26-000001
function formatSaleDraftNo(yy, seq) {
  return `SD-${yy}-${pad6(seq)}`;
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

export default function SaleForm({
  products,
  caris,
  balances,
  settings,
  onSubmit,
  onDeleteDraft = null,
  disabled,
  initialData = null,
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

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftInfo, setDraftInfo] = useState(null);
  const [showPurchaseCost, setShowPurchaseCost] = useState(false);
  const [allowPurchaseCostEdit, setAllowPurchaseCostEdit] = useState(false);

  const [saleId, setSaleId] = useState("");

  // Header-ish
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("draft");

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
  const [paymentStatus, setPaymentStatus] = useState("unpaid"); // unpaid | partial | paid
  const [paidAmount, setPaidAmount] = useState(0);

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
      purchaseUnitCost: 0,
    },
  ]);

  const isEditMode = !!(initialData?.id || initialData?.saleId || saleId);

  /* ===============================
     INITIAL DATA LOAD (EDIT FIRST)
  ================================ */

  useEffect(() => {
    if (!initialData) return;

    setSaleId(initialData.id || initialData.saleId || "");
    setInvoiceDate(
      toISODate(initialData.invoiceDate) ||
        toISODate(initialData.documentDate) ||
        todayISO()
    );
    setDueDate(toISODate(initialData.dueDate) || "");
    setStatus(normalizeStatus(initialData.status || "draft"));

    setSaleType(initialData.saleType === "official" ? "official" : "actual");
    setSaleChannel(initialData.saleChannel || initialData.platformId || defaultPlatform);
    setVatMode(initialData.vatMode || "exclude");

    const resolvedInvoice =
      initialData.invoiceNo ||
      initialData.saleNo ||
      initialData.draftNo ||
      "";

    setInvoiceNo(resolvedInvoice);
    setInvoiceNoDirty(!!resolvedInvoice);

    setCariId(initialData.cariId || "");
    setCariSearch("");

    const payment = initialData.payment || {};
    const resolvedPaidAmount = Number(
      payment.paidAmount ?? initialData.paidAmount ?? 0
    ) || 0;

    setPaymentMethod(payment.method || initialData.paymentMethod || "bank");
    setPaidAmount(resolvedPaidAmount);

    const detectedPaymentStatus =
      payment.status ||
      initialData.paymentStatus ||
      (resolvedPaidAmount <= 0
        ? "unpaid"
        : resolvedPaidAmount >= Number(initialData.grossTotal || 0)
        ? "paid"
        : "partial");

    setPaymentStatus(
      detectedPaymentStatus === "paid"
        ? "paid"
        : detectedPaymentStatus === "partial"
        ? "partial"
        : "unpaid"
    );

    const meta = initialData.meta || {};
    const delivery = meta.delivery || {};
    const notes = meta.notes || {};

    setDeliveryMode(delivery.mode || "pickup");
    setDeliveryDate(toISODate(delivery.deliveryDate) || "");
    setPlateNo(delivery.plateNo || "");
    setLoadingArea(delivery.loadingArea || "Ana Terminal Peron 02");
    setCustomerNote(notes.customer || "");
    setInternalNote(notes.internal || "");

    const loadedItems = Array.isArray(initialData.items) ? initialData.items : [];
    if (loadedItems.length) {
      setItems(
        loadedItems.map((x) => ({
          productId: x.productId || "",
          productName: x.productName || "",
          unit: x.unit || defaultUnit,
          warehouseKey: x.warehouseKey || defaultWarehouse,
          quantity: Number(x.quantity || 0) || 1,
          unitPrice: Number(x.unitPrice || 0) || 0,
          discountRate: Number(x.discountRate || 0) || 0,
          vatRate: Number(x.vatRate ?? defaultVatRate) || 0,
          net: Number(x.net || 0) || 0,
          vat: Number(x.vat || 0) || 0,
          total: Number(x.total || 0) || 0,
          purchaseUnitCost: Number(x.purchaseUnitCost ?? x.costAtSale ?? 0) || 0,
        }))
      );
    }

    setDraftInfo(null);
  }, [initialData, defaultPlatform, defaultUnit, defaultWarehouse, defaultVatRate]);

  /* ===============================
     LOCAL DRAFT AUTO-LOAD (ONLY NEW)
  ================================ */

  useEffect(() => {
    if (draftLoaded) return;
    if (initialData) {
      setDraftLoaded(true);
      return;
    }

    setDraftLoaded(true);

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;

      setInvoiceDate(d.invoiceDate || todayISO());
      setDueDate(d.dueDate || "");
      setStatus(normalizeStatus(d.status || d.processStatus || "draft"));

      setSaleType(d.saleType || "actual");
      setSaleChannel(d.saleChannel || defaultPlatform);
      setVatMode(d.vatMode || "exclude");

      setInvoiceNo(d.invoiceNo || "");
      setInvoiceNoDirty(Boolean(d.invoiceNoDirty));

      setCariId(d.cariId || "");
      setCariSearch("");

      setPaymentMethod(d.paymentMethod || "bank");
      const loadedPaidAmount = Number(d.paidAmount || 0) || 0;
      setPaidAmount(loadedPaidAmount);
      setPaymentStatus(
        d.paymentStatus ||
          (loadedPaidAmount <= 0
            ? "unpaid"
            : loadedPaidAmount >= Number(d?.totals?.total || 0) && Number(d?.totals?.total || 0) > 0
            ? "paid"
            : "partial")
      );

      setDeliveryMode(d.deliveryMode || "pickup");
      setDeliveryDate(d.deliveryDate || "");
      setPlateNo(d.plateNo || "");
      setLoadingArea(d.loadingArea || "Ana Terminal Peron 02");
      setCustomerNote(d.customerNote || "");
      setInternalNote(d.internalNote || "");

      const loadedItems = Array.isArray(d.items) ? d.items : [];
      if (loadedItems.length) {
        setItems(
          loadedItems.map((x) => ({
            productId: x.productId || "",
            productName: x.productName || "",
            unit: x.unit || defaultUnit,
            warehouseKey: x.warehouseKey || defaultWarehouse,
            quantity: Number(x.quantity || 0) || 1,
            unitPrice: Number(x.unitPrice || 0) || 0,
            discountRate: Number(x.discountRate || 0) || 0,
            vatRate: Number(x.vatRate ?? defaultVatRate) || 0,
            net: Number(x.net || 0) || 0,
            vat: Number(x.vat || 0) || 0,
            total: Number(x.total || 0) || 0,
            purchaseUnitCost: Number(x.purchaseUnitCost ?? x.costAtSale ?? 0) || 0,
          }))
        );
      }

      setDraftInfo({
        savedAt: d.savedAt || null,
      });
    } catch {
      // ignore
    }
  }, [
    draftLoaded,
    initialData,
    defaultPlatform,
    defaultUnit,
    defaultWarehouse,
    defaultVatRate,
  ]);

  /* ===============================
     SETTINGS DEFAULT PATCH
  ================================ */

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
        purchaseUnitCost: Number(r.purchaseUnitCost || 0) || 0,
      }))
    );
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

  const filledItemCount = useMemo(
    () => items.filter((row) => row?.productId && Number(row.quantity || 0) > 0).length,
    [items]
  );

  const vatDisabled = saleType !== "official";

  const yy = useMemo(() => year2FromDateISO(invoiceDate), [invoiceDate]);

  /* ===============================
     DOCUMENT NO PREVIEW
  ================================ */

  useEffect(() => {
    const loadPreview = async () => {
      if (invoiceNoDirty) return;
      if (loadingInvoiceRef.current) return;

      if (
        initialData &&
        (initialData.invoiceNo || initialData.saleNo || initialData.draftNo)
      ) {
        return;
      }

      loadingInvoiceRef.current = true;

      try {
        if (status === "completed") {
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

          setInvoiceNo(formatSaleInvoiceNo(saleType, yy, nextSeq));
        } else {
          const ref = doc(db, "draft_counters", "sales");
          const snap = await getDoc(ref);

          const data = snap.exists() ? snap.data() : {};
          const years = (data && typeof data === "object" ? data.years : null) || {};
          const yearMap =
            (years && typeof years === "object" ? years[yy] : null) || {};

          const currentSeq = Number((yearMap && yearMap.seq) ?? 0);
          const nextSeq = currentSeq + 1;

          setInvoiceNo(formatSaleDraftNo(yy, nextSeq));
        }
      } catch (e) {
        console.error("SALE invoice preview error:", e);
        setInvoiceNo("");
      } finally {
        loadingInvoiceRef.current = false;
      }
    };

    loadPreview();
  }, [saleType, yy, invoiceNoDirty, status, initialData]);

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

  function clearLocalDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setDraftInfo(null);
  }

  function saveLocalDraft() {
    const payload = {
      savedAt: Date.now(),
      invoiceDate,
      dueDate,
      status,
      saleType,
      saleChannel,
      vatMode,
      invoiceNo,
      invoiceNoDirty,
      cariId,
      paymentMethod,
      paymentStatus,
      paidAmount,
      deliveryMode,
      deliveryDate,
      plateNo,
      loadingArea,
      customerNote,
      internalNote,
      items: (Array.isArray(items) ? items : []).map((r) => ({
        ...r,
        purchaseUnitCost: Number(r.purchaseUnitCost || 0) || 0,
      })),
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setDraftInfo({ savedAt: payload.savedAt });
    } catch (e) {
      console.error("DRAFT_SAVE_ERR:", e);
    }
  }

  function validate(nextStatus) {
    if (nextStatus === "draft" || nextStatus === "pending") {
      if (!cariId && items.filter((x) => x?.productId).length === 0) {
        alert("Taslak için en az müşteri ya da ürün satırı seçilmiş olmalı.");
        return false;
      }
      return true;
    }

    if (!invoiceDate) {
      alert("Fatura tarihi gerekli.");
      return false;
    }

    if (!cariId) {
      alert("Müşteri seçmelisin.");
      return false;
    }

    const validRows = items.filter(
      (r) => r?.productId && Number(r.quantity || 0) > 0
    );
    if (!validRows.length) {
      alert("En az bir geçerli ürün satırı gerekli.");
      return false;
    }

    return true;
  }

  async function submit(nextStatus) {
    if (!validate(nextStatus)) return;

    const fixedItems = (Array.isArray(items) ? [...items] : []).map((r) => {
      const row = {
        ...r,
        purchaseUnitCost: Math.max(0, Number(r.purchaseUnitCost || 0) || 0),
      };
      calcLine(row);
      return row;
    });
    setItems(fixedItems);

    const totalFromFixedItems = fixedItems.reduce(
      (sum, r) => sum + (Number(r.total) || 0),
      0
    );

    const orderTotal = Number(totalFromFixedItems || 0) || 0;
    let finalPaidAmount = 0;

    if (paymentStatus === "paid") {
      finalPaidAmount = orderTotal;
    } else if (paymentStatus === "partial") {
      finalPaidAmount = Math.max(0, Math.min(Number(paidAmount || 0) || 0, orderTotal));
    } else {
      finalPaidAmount = 0;
    }

    const payload = {
      saleId: saleId || initialData?.id || initialData?.saleId || null,
      id: saleId || initialData?.id || initialData?.saleId || null,

      status: nextStatus,

      invoiceDate,
      dueDate: dueDate || null,
      saleType,
      saleChannel,
      platformId: saleChannel,
      vatMode,
      invoiceNo: invoiceNo?.trim() || "",
      invoiceNoAuto: !invoiceNoDirty,
      invoiceNoDirty: Boolean(invoiceNoDirty && invoiceNo?.trim()),
      cariId: cariId || null,

      paymentMethod,
      paymentStatus,
      paidAmount: finalPaidAmount,
      payment: {
        method: paymentMethod,
        status: paymentStatus,
        paidAmount: finalPaidAmount,
        isPaid: paymentStatus === "paid",
      },

      meta: {
        status: nextStatus,
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
    };

    if (nextStatus === "draft" && !initialData && !saleId) {
      saveLocalDraft();
    }

    await onSubmit(payload);
  }

  async function handleDeleteDraft() {
    const currentSaleId = saleId || initialData?.id || initialData?.saleId;
    if (!currentSaleId) {
      clearLocalDraft();
      alert("Yerel taslak temizlendi.");
      return;
    }

    if (status === "completed") {
      alert("Tamamlanmış satış taslak olarak silinemez.");
      return;
    }

    if (!onDeleteDraft) {
      alert("Taslak silme işlemi bu sayfada bağlı değil.");
      return;
    }

    const ok = confirm("Bu taslağı silmek istediğine emin misin?");
    if (!ok) return;

    await onDeleteDraft({ saleId: currentSaleId });
  }

  const statusLabel =
    status === "completed"
      ? "Onaylandı"
      : status === "pending"
      ? "Onay Bekliyor"
      : isEditMode
      ? "Kaydedilmiş Taslak"
      : "Taslak";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="max-w-[1680px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 gap-5">
          {/* LEFT */}
          <div className="col-span-12 space-y-5 lg:col-span-9">
            {/* Header */}
            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.35)]">
              <div className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                <span>Satış Operasyonları</span>
                <span className="text-slate-300">/</span>
                <span>Fatura Yönetimi</span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/40">
                  <Wallet size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950 leading-none">
                    {isEditMode ? "Satış Kaydını Düzenle" : "Satış Faturası Oluştur"}
                  </h1>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span
                      className={
                        status === "completed"
                          ? "px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase"
                          : status === "pending"
                          ? "px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase"
                          : "px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase"
                      }
                    >
                      {statusLabel}
                    </span>
                    <span className="text-slate-300">|</span>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                      Belge No:{" "}
                      <span className="text-slate-900">
                        {invoiceNo?.trim() ? invoiceNo : "Otomatik"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid w-full gap-4 sm:w-auto sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-[0.18em]">
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
                      className="pl-9 h-11 w-full rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-[0.18em]">
                    Vade Tarihi
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-11 w-full rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none px-3"
                    disabled={disabled}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 min-w-[220px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-[0.18em]">
                    Süreç Durumu
                  </label>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(normalizeStatus(e.target.value));
                      if (!isEditMode) setInvoiceNoDirty(false);
                    }}
                    className="h-11 w-full rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none px-3"
                    disabled={disabled}
                  >
                    <option value="draft">Taslak</option>
                    <option value="pending">Onay Bekliyor</option>
                    <option value="completed">Onaylandı</option>
                  </select>
                </div>
              </div>
              </div>
            </div>

            {draftInfo?.savedAt && !initialData && (
              <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-bold">Yerel taslak yüklendi.</span>
                  <span className="ml-2 text-blue-700 text-xs">
                    (Kaydedilme:{" "}
                    {new Date(draftInfo.savedAt).toLocaleString("tr-TR")})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearLocalDraft}
                  className="px-3 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100"
                  disabled={disabled}
                >
                  Yerel Taslağı Sil
                </button>
              </div>
            )}

            {negativeStockWarnings.length > 0 && status === "completed" && (
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
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.9fr_0.9fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <Building2 size={22} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        Cari Hesap Seçimi
                      </div>
                      <h3 className="text-xl font-black leading-tight tracking-[-0.03em] text-slate-950">
                        {selectedCari?.firm || "Müşteri seçilmedi"}
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => document.getElementById("sale-cari-select")?.focus()}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                    disabled={disabled}
                  >
                    Değiştir
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-4">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Şirket Adı / BIN / Telefon ara..."
                    value={cariSearch}
                    onChange={(e) => setCariSearch(e.target.value)}
                    disabled={disabled}
                  />

                  <select
                    id="sale-cari-select"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        BIN
                      </div>
                      <div className="mt-1 text-lg font-black text-slate-950">
                        {selectedCari?.bin || "-"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Telefon
                      </div>
                      <div className="mt-1 text-lg font-black text-slate-950">
                        {selectedCari?.mobile || "-"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Risk Grubu
                      </div>
                      <div className="mt-1 text-lg font-black text-emerald-700">
                        {selectedCari?.riskGroup || "Standart"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Belge No (Opsiyonel)
                    </label>
                    <input
                      className="border border-slate-200 bg-white rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Boş bırakırsan sistem üretir."
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-slate-50 px-4 py-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Kredi Limiti
                        </div>
                        <div className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
                          {fmtMoney(selectedCari?.creditLimit || 0)} ₸
                        </div>
                      </div>
                      <div className="rounded-2xl border-l-4 border-rose-500 bg-slate-50 px-4 py-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Mevcut Bakiye
                        </div>
                        <div className="mt-1 text-2xl font-black tracking-[-0.03em] text-rose-600">
                          {fmtMoney(selectedCari?.currentBalance || 0)} ₸
                        </div>
                      </div>
                    </div>

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

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Satış Türü</span>
                    <span className="text-xl font-black tracking-[-0.03em] text-slate-950">
                      {saleType === "official" ? "Resmi" : "Fiili"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Kanal</span>
                    <span className="text-xl font-black tracking-[-0.03em] text-slate-950">
                      {(platforms || []).find((p) => p.key === saleChannel)?.label || saleChannel || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Fatura No</span>
                    <span className="text-xl font-black tracking-[0.06em] text-slate-950">
                      {invoiceNo?.trim() || "OTOMATIK"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Vade Tarihi</span>
                    <span className="text-xl font-black tracking-[-0.03em] text-slate-950">
                      {dueDate || "-"}
                    </span>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <span>Ek Ayarlar</span>
                    <span>{vatMode === "include" ? "KDV Dahil" : "KDV Hariç"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sale type + Platform */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
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

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
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

            {/* Items */}
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="text-blue-700" size={18} />
                  <h3 className="font-bold text-slate-900">Fatura Satırları</h3>
                </div>
                <div className="text-xs text-slate-500">Alt+N: satır ekle</div>
              </div>

              <div className="px-4 pt-4">
                <div className="border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Satış maliyet görünümü
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Alış fiyatını satır bazında göster, gerekirse manuel düzelt.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={showPurchaseCost}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setShowPurchaseCost(checked);
                          if (!checked) setAllowPurchaseCostEdit(false);
                        }}
                        disabled={disabled}
                      />
                      Alış fiyatını göster
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={allowPurchaseCostEdit}
                        onChange={(e) => setAllowPurchaseCostEdit(e.target.checked)}
                        disabled={disabled || !showPurchaseCost}
                      />
                      Düzenlemeye aç
                    </label>
                  </div>
                </div>
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
                showPurchaseCost={showPurchaseCost}
                allowPurchaseCostEdit={allowPurchaseCostEdit}
              />
            </div>

            {/* Logistics */}
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
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

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
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
          <div className="col-span-12 space-y-5 lg:col-span-3">
            <div className="sticky top-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)]">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400 font-bold">
                Toplam Tutar
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                {fmtMoney(totals.total)} ₸
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {vatDisabled ? "KDV Pasif" : "KDV Aktif"}
              </div>

              <div className="mt-8 space-y-3 border-t border-slate-200 pt-5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Ara Toplam</span>
                  <span className="font-bold">{fmtMoney(totals.net)} ₸</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>KDV Toplamı</span>
                  <span className="font-bold">
                    {fmtMoney(vatDisabled ? 0 : totals.vat)} ₸
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Toplam İndirim</span>
                  <span className="font-bold text-red-300">
                    -{fmtMoney(totals.discount)} ₸
                  </span>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-5 space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">
                  Ödeme Yöntemi
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 px-4 text-sm font-bold outline-none"
                  disabled={disabled}
                >
                  <option value="bank">Banka Havalesi</option>
                  <option value="cash">Nakit</option>
                  <option value="kaspi">Kaspi</option>
                </select>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">
                    Ödeme Durumu
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatus("unpaid");
                        setPaidAmount(0);
                      }}
                      className={
                        paymentStatus === "unpaid"
                          ? "h-10 rounded-xl border border-slate-950 bg-slate-950 text-sm font-semibold text-white"
                          : "h-10 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      }
                      disabled={disabled}
                      title="Bu satış faturası için tahsilat alınmadı"
                    >
                      Alınmadı
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const totalAmount = Number(totals.total || 0) || 0;
                        const currentAmount = Number(paidAmount || 0) || 0;
                        setPaymentStatus("partial");
                        if (currentAmount <= 0 && totalAmount > 0) {
                          setPaidAmount(Math.min(totalAmount, totalAmount / 2));
                        }
                      }}
                      className={
                        paymentStatus === "partial"
                          ? "h-10 rounded-xl bg-amber-500 text-sm font-semibold text-white"
                          : "h-10 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      }
                      disabled={disabled}
                      title="Bu satış faturası için kısmi tahsilat alındı"
                    >
                      Kısmi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const totalAmount = Number(totals.total || 0) || 0;
                        setPaymentStatus("paid");
                        setPaidAmount(totalAmount);
                      }}
                      className={
                        paymentStatus === "paid"
                          ? "h-10 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
                          : "h-10 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      }
                      disabled={disabled}
                      title="Bu satış faturası için tam tahsilat alındı"
                    >
                      Tam Ödeme
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">
                      Tahsil Edilen Tutar
                    </label>
                    <input
                      type="number"
                      value={paymentStatus === "paid" ? Number(totals.total || 0) || 0 : paidAmount}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0) || 0;
                        const max = Number(totals.total || 0) || 0;
                        const clamped = Math.max(0, Math.min(v, max));
                        setPaidAmount(clamped);

                        if (clamped <= 0) {
                          setPaymentStatus("unpaid");
                        } else if (clamped >= max && max > 0) {
                          setPaymentStatus("paid");
                        } else {
                          setPaymentStatus("partial");
                        }
                      }}
                      className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 px-4 text-sm font-bold outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={disabled || paymentStatus === "unpaid" || paymentStatus === "paid"}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">
                      Kalan Bakiye
                    </label>
                    <div className="flex h-11 w-full items-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-extrabold text-rose-700">
                      {fmtMoney(remaining)} ₸
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2 rounded-2xl bg-slate-100 px-4 py-4">
                <div className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Belge Ozeti</div>
                <div className="text-sm font-semibold text-slate-950">
                  {selectedCari?.firm || "Musteri secilmedi"}
                </div>
                <div className="text-xs text-slate-500">
                  {filledItemCount} gecerli satir â€¢ {negativeStockWarnings.length > 0
                    ? `${negativeStockWarnings.length} stok uyarisi`
                    : "stok uyarisi yok"}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => submit("completed")}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-extrabold flex items-center justify-center gap-2 active:scale-95 transition"
                  disabled={disabled}
                >
                  <Send size={18} />
                  Onayla ve Tamamla
                </button>

                <button
                  type="button"
                  onClick={() => submit("pending")}
                  className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                  disabled={disabled}
                >
                  <Clock3 size={16} />
                  Onay Bekliyor
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => submit("draft")}
                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                    disabled={disabled}
                  >
                    <Save size={18} />
                    Taslağı Kaydet
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                    disabled={disabled}
                    onClick={() => window.print()}
                  >
                    <FileDown size={18} />
                    Yazdır (PDF)
                  </button>
                </div>

                {status !== "completed" && isEditMode && !!onDeleteDraft && (
                  <button
                    type="button"
                    onClick={handleDeleteDraft}
                    className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                    disabled={disabled}
                  >
                    <Trash2 size={16} />
                    Taslağı Sil
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)] space-y-4">
              <div className="text-sm font-extrabold uppercase tracking-[0.2em] text-slate-500">
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
