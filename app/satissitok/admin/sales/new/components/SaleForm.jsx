"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  ClipboardList,
  Clock3,
  Eye,
  EyeOff,
  FileDown,
  Save,
  Send,
  Trash2,
  Truck,
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

function cleanOptionText(value) {
  return String(value || "").trim();
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

function formatSaleInvoiceNo(type, yy, seq) {
  const prefix = type === "official" ? "SR" : "SF";
  return `${prefix}-${yy}-${pad6(seq)}`;
}

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
  const activePlatforms = useMemo(
    () =>
      (platforms || []).filter(
        (platform) => platform?.active !== false && cleanOptionText(platform?.key)
      ),
    [platforms]
  );

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

  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("draft");

  const [saleType, setSaleType] = useState("actual");
  const [saleChannel, setSaleChannel] = useState(defaultPlatform);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceNoDirty, setInvoiceNoDirty] = useState(false);
  const loadingInvoiceRef = useRef(false);
  const [vatMode, setVatMode] = useState("exclude");

  const [cariSearch, setCariSearch] = useState("");
  const [cariId, setCariId] = useState("");
  const selectedCari = useMemo(
    () => caris?.find((c) => c.id === cariId) || null,
    [caris, cariId]
  );

  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [paidAmount, setPaidAmount] = useState(0);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProfitDetails, setShowProfitDetails] = useState(false);

  const [deliveryMode, setDeliveryMode] = useState("pickup");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [loadingArea, setLoadingArea] = useState("Ana Terminal Peron 02");
  const [customerNote, setCustomerNote] = useState("");
  const [internalNote, setInternalNote] = useState("");

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

  useEffect(() => {
    if (!activePlatforms.length) return;

    const currentKey = cleanOptionText(saleChannel);
    const hasCurrent = activePlatforms.some((platform) => platform.key === currentKey);

    if (!currentKey || !hasCurrent) {
      setSaleChannel(defaultPlatform || activePlatforms[0]?.key || "");
    }
  }, [activePlatforms, defaultPlatform, saleChannel]);

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
            : loadedPaidAmount >= Number(d?.totals?.total || 0) &&
              Number(d?.totals?.total || 0) > 0
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

  const profitability = useMemo(() => {
    const cost = items.reduce((sum, row) => {
      const qty = Number(row?.quantity || 0) || 0;
      const unitCost = Number(row?.purchaseUnitCost ?? row?.costAtSale ?? 0) || 0;
      return sum + qty * unitCost;
    }, 0);

    const costTotal = Math.round(cost * 100) / 100;
    const netProfit = Math.round((totals.net - costTotal) * 100) / 100;
    const grossProfit = Math.round((totals.total - costTotal) * 100) / 100;

    return {
      costTotal,
      netProfit,
      grossProfit,
    };
  }, [items, totals.net, totals.total]);

  const filledItemCount = useMemo(
    () => items.filter((row) => row?.productId && Number(row.quantity || 0) > 0).length,
    [items]
  );

  const vatDisabled = saleType !== "official";
  const vatSummaryLabel = useMemo(() => {
    if (vatDisabled) {
      return "KDV (Fiili Satis - Hesaplanmaz)";
    }

    const usedRates = Array.from(
      new Set(
        (items || [])
          .filter((row) => row?.productId)
          .map((row) => Number(row?.vatRate ?? defaultVatRate))
          .filter((rate) => Number.isFinite(rate))
      )
    );

    if (usedRates.length === 1) {
      return `KDV (%${usedRates[0]} - ${
        vatMode === "include" ? "Dahil" : "Haric"
      })`;
    }

    if (usedRates.length > 1) {
      return `KDV (Karisik - ${vatMode === "include" ? "Dahil" : "Haric"})`;
    }

    return `KDV (%${defaultVatRate} - ${
      vatMode === "include" ? "Dahil" : "Haric"
    })`;
  }, [vatDisabled, items, defaultVatRate, vatMode]);

  const yy = useMemo(() => year2FromDateISO(invoiceDate), [invoiceDate]);

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
        alert("Taslak icin en az musteri ya da urun satiri secilmis olmali.");
        return false;
      }
      return true;
    }

    if (!invoiceDate) {
      alert("Fatura tarihi gerekli.");
      return false;
    }

    if (!cariId) {
      alert("Musteri secmelisin.");
      return false;
    }

    const validRows = items.filter(
      (r) => r?.productId && Number(r.quantity || 0) > 0
    );
    if (!validRows.length) {
      alert("En az bir gecerli urun satiri gerekli.");
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
      alert("Tamamlanmis satis taslak olarak silinemez.");
      return;
    }

    if (!onDeleteDraft) {
      alert("Taslak silme islemi bu sayfada bagli degil.");
      return;
    }

    const ok = confirm("Bu taslagi silmek istedigine emin misin?");
    if (!ok) return;

    await onDeleteDraft({ saleId: currentSaleId });
  }

  const statusLabel =
    status === "completed"
      ? "Onaylandi"
      : status === "pending"
      ? "Onay Bekliyor"
      : "Taslak";

  return (
    <div className="text-slate-900">
      <div className="mx-auto max-w-[1640px]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-6 xl:pr-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Satis Operasyonlari</span>
              <span className="text-slate-300">/</span>
              <span>Fatura Yonetimi</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-[-0.05em] text-slate-950">
                  Yeni Satis Faturasi
                </h1>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                  {statusLabel}
                </span>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <span className="text-xl leading-none">...</span>
              </button>
            </div>

            {draftInfo?.savedAt && !initialData && (
              <div className="rounded-[18px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Yerel taslak yuklendi: {new Date(draftInfo.savedAt).toLocaleString("tr-TR")}
              </div>
            )}

            {negativeStockWarnings.length > 0 && status === "completed" && (
              <div className="flex items-start gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle size={18} className="mt-0.5 text-amber-600" />
                <div>
                  <div className="font-bold">Negatif stok uyarisi</div>
                  <div className="mt-1 text-xs">
                    {negativeStockWarnings.slice(0, 3).map((warning) => (
                      <div key={`${warning.productId}_${warning.warehouseKey}`}>
                        {warning.productName || warning.productId}: {warning.available} / {warning.need}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Cari Hesap Secimi
                      </div>
                      <div className="mt-1 text-[20px] font-black tracking-[-0.04em] text-slate-950">
                        {selectedCari?.firm || "Musteri Secilmedi"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomerPicker((prev) => !prev);
                      setTimeout(() => {
                        document.getElementById("sale-cari-select")?.focus();
                      }, 0);
                    }}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
                    disabled={disabled}
                  >
                    Degistir
                  </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Kredi Limiti
                    </div>
                    <div className="mt-2 text-lg font-black tracking-[-0.04em] text-slate-900">
                      {fmtMoney(selectedCari?.creditLimit || 0)} ₸
                    </div>
                  </div>
                  <div className="rounded-lg border-l-[3px] border-red-500 bg-slate-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Mevcut Bakiye
                    </div>
                    <div className="mt-2 text-lg font-black tracking-[-0.04em] text-red-600">
                      {fmtMoney(selectedCari?.currentBalance || 0)} ₸
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Risk Grubu
                    </div>
                    <div className="mt-2 text-lg font-black tracking-[-0.04em] text-emerald-700">
                      {selectedCari?.riskGroup || "Dusuk Risk"}
                    </div>
                  </div>
                </div>

                {showCustomerPicker ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.15fr_1fr_0.9fr]">
                    <input
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none focus:border-slate-400"
                      placeholder="Sirket / BIN / telefon ara"
                      value={cariSearch}
                      onChange={(e) => setCariSearch(e.target.value)}
                      disabled={disabled}
                    />
                    <select
                      id="sale-cari-select"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none focus:border-slate-400"
                      value={cariId}
                      onChange={(e) => {
                        setCariId(e.target.value);
                        if (e.target.value) setShowCustomerPicker(false);
                      }}
                      disabled={disabled}
                    >
                      <option value="">Musteri sec...</option>
                      {cariOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firm || "-"} {c.bin ? `(${c.bin})` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none focus:border-slate-400"
                      placeholder="Belge No"
                      value={invoiceNo}
                      onChange={(e) => {
                        setInvoiceNo(e.target.value);
                        setInvoiceNoDirty(Boolean(e.target.value.trim()));
                      }}
                      disabled={disabled}
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <span>
                      {selectedCari
                        ? "Cari bilgilerini guncellemek icin Degistir butonunu kullan."
                        : "Cari secimi yapmak icin Degistir butonunu kullan."}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Belge No: {invoiceNo?.trim() || "Otomatik"}
                    </span>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Satis Turu</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSaleType("official")}
                        className={`rounded-md px-2 py-1 font-bold ${
                          saleType === "official" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                        disabled={disabled}
                      >
                        Resmi
                      </button>
                      <button
                        type="button"
                        onClick={() => setSaleType("actual")}
                        className={`rounded-md px-2 py-1 font-bold ${
                          saleType === "actual" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                        disabled={disabled}
                      >
                        Fiili
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Kanal</span>
                    <select
                      value={saleChannel}
                      onChange={(e) => setSaleChannel(e.target.value)}
                      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-right text-sm font-bold outline-none"
                      disabled={disabled}
                    >
                      {activePlatforms.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.label || p.key}
                          </option>
                        ))}
                      {!activePlatforms.length && (
                        <option value="">Platform tanimli degil</option>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Belge No</span>
                    <input
                      type="text"
                      value={invoiceNo}
                      onChange={(e) => {
                        setInvoiceNo(e.target.value);
                        setInvoiceNoDirty(Boolean(e.target.value.trim()));
                      }}
                      placeholder="Otomatik"
                      className="h-9 w-[150px] rounded-md border border-slate-200 bg-white px-3 text-right text-sm font-bold text-slate-900 outline-none focus:border-slate-400"
                      disabled={disabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Vade Tarihi</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-right text-sm font-bold outline-none"
                      disabled={disabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Fatura Tarihi</span>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-right text-sm font-bold outline-none"
                      disabled={disabled}
                    />
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      <span>Ek Ayarlar</span>
                      <span>+</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setVatMode("exclude")}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${
                          vatMode === "exclude" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                        } ${vatDisabled ? "opacity-50" : ""}`}
                        disabled={disabled || vatDisabled}
                      >
                        KDV Haric
                      </button>
                      <button
                        type="button"
                        onClick={() => setVatMode("include")}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${
                          vatMode === "include" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                        } ${vatDisabled ? "opacity-50" : ""}`}
                        disabled={disabled || vatDisabled}
                      >
                        KDV Dahil
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Maliyet goster</span>
                      <input
                        type="checkbox"
                        checked={showPurchaseCost}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setShowPurchaseCost(checked);
                          if (!checked) setAllowPurchaseCostEdit(false);
                        }}
                        disabled={disabled}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Maliyet duzenle</span>
                      <input
                        type="checkbox"
                        checked={allowPurchaseCostEdit}
                        onChange={(e) => setAllowPurchaseCostEdit(e.target.checked)}
                        disabled={disabled || !showPurchaseCost}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  Fatura Satirlari
                </h2>
                <span className="text-xs font-medium text-slate-500">{filledItemCount} Urun Eklendi</span>
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
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Truck size={14} />
                  Lojistik ve Sevkiyat
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Teslim Adresi
                    </span>
                    <textarea
                      className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                      value={selectedCari?.legalAddress || ""}
                      readOnly
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      value={deliveryMode}
                      onChange={(e) => setDeliveryMode(e.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                      disabled={disabled}
                    >
                      <option value="pickup">Musteri Alir</option>
                      <option value="courier">Lojistik Firmasi</option>
                      <option value="cargo">Kargo</option>
                      <option value="customer">Musteri Nakliyesi</option>
                    </select>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                      disabled={disabled}
                    />
                    <input
                      value={plateNo}
                      onChange={(e) => setPlateNo(e.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                      placeholder="Plaka"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <ClipboardList size={14} />
                  Notlar ve Aciklamalar
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Musteri Notu
                    </span>
                    <textarea
                      className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      disabled={disabled}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Dahili Not
                    </span>
                    <textarea
                      className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      disabled={disabled}
                    />
                  </label>
                </div>
              </section>
            </div>
          </div>

          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)] xl:sticky xl:top-24 xl:h-[calc(100vh-128px)]">
            <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-7">
            <div className="border-b border-slate-200 pb-6">
              <div className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                Toplam Tutar
              </div>
              <div className="mt-2 text-center text-[26px] font-black tracking-[-0.06em] text-slate-950">
                {fmtMoney(totals.total)} ₸
              </div>
            </div>

            <div className="space-y-4 py-6">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Ara Toplam</span>
                  <span className="font-bold text-slate-900">{fmtMoney(totals.net)} ₸</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Toplam Iskonto</span>
                  <span className="font-bold text-red-500">-{fmtMoney(totals.discount)} ₸</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>{vatSummaryLabel}</span>
                  <span className="font-bold text-slate-900">{fmtMoney(vatDisabled ? 0 : totals.vat)} ₸</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-950">
                  <span>Genel Toplam</span>
                  <span>{fmtMoney(totals.total)} ₸</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    Karlilik
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfitDetails((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
                    disabled={disabled}
                  >
                    {showProfitDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showProfitDetails ? "Gizle" : "Goster"}
                  </button>
                </div>

                <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Toplam Maliyet</span>
                    <span className="font-bold text-slate-900">
                      {showProfitDetails ? `${fmtMoney(profitability.costTotal)} ₸` : "•••••"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Net Kar</span>
                    <span
                      className={`font-bold ${
                        profitability.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {showProfitDetails ? `${fmtMoney(profitability.netProfit)} ₸` : "•••••"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Brut Kar</span>
                    <span
                      className={`font-bold ${
                        profitability.grossProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {showProfitDetails ? `${fmtMoney(profitability.grossProfit)} ₸` : "•••••"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Odeme Bilgileri
                </div>

                <label className="mb-4 block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Odeme Yontemi
                  </span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none"
                    disabled={disabled}
                  >
                    <option value="bank">Banka Havalesi / EFT</option>
                    <option value="cash">Nakit</option>
                    <option value="kaspi">Kaspi</option>
                  </select>
                </label>

                <div className="mb-4">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Odeme Durumu
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatus("unpaid");
                        setPaidAmount(0);
                      }}
                      className={`h-9 rounded-md text-xs font-bold ${
                        paymentStatus === "unpaid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                      disabled={disabled}
                    >
                      Odenmedi
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
                      className={`h-9 rounded-md text-xs font-bold ${
                        paymentStatus === "partial" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                      disabled={disabled}
                    >
                      Kismi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const totalAmount = Number(totals.total || 0) || 0;
                        setPaymentStatus("paid");
                        setPaidAmount(totalAmount);
                      }}
                      className={`h-9 rounded-md text-xs font-bold ${
                        paymentStatus === "paid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                      disabled={disabled}
                    >
                      Odendi
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Odenen Tutar
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        value={paymentStatus === "paid" ? Number(totals.total || 0) || 0 : paidAmount}
                        onChange={(e) => {
                          const value = Number(e.target.value || 0) || 0;
                          const max = Number(totals.total || 0) || 0;
                          const clamped = Math.max(0, Math.min(value, max));
                          setPaidAmount(clamped);

                          if (clamped <= 0) {
                            setPaymentStatus("unpaid");
                          } else if (clamped >= max && max > 0) {
                            setPaymentStatus("paid");
                          } else {
                            setPaymentStatus("partial");
                          }
                        }}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 pr-8 text-sm font-bold outline-none"
                        disabled={disabled || paymentStatus === "unpaid" || paymentStatus === "paid"}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₸</span>
                    </div>
                  </label>
                  <div>
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Kalan Bakiye
                    </span>
                    <div className="flex h-11 items-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600">
                      {fmtMoney(remaining)} ₸
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-100 px-4 py-4 text-center text-lg font-black text-slate-800">
                {selectedCari?.firm || "MUSTERI SECILMEDI"}
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => submit("completed")}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white transition hover:bg-slate-800"
                  disabled={disabled}
                >
                  <Send size={16} />
                  Onayla ve Tamamla
                </button>
                <button
                  type="button"
                  onClick={() => submit("pending")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                  disabled={disabled}
                >
                  <Clock3 size={15} />
                  Onay Bekliyor
                </button>
                <button
                  type="button"
                  onClick={() => submit("draft")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold uppercase tracking-[0.16em] text-slate-500 transition hover:bg-slate-50"
                  disabled={disabled}
                >
                  <Save size={15} />
                  Taslagi Kaydet
                </button>
              </div>
            </div>
            </div>

            <div className="grid grid-cols-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-col items-center gap-2 px-3 py-4 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                disabled={disabled}
              >
                <FileDown size={16} />
                PDF Yazdir
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                className="flex flex-col items-center gap-2 border-x border-slate-200 px-3 py-4 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                disabled={disabled || (status === "completed" && isEditMode)}
              >
                <Trash2 size={16} />
                Sil
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-2 px-3 py-4 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                disabled
              >
                <BadgeCheck size={16} />
                Paylas
              </button>
            </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
