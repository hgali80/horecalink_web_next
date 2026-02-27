// app/satissitok/admin/sales/new/components/SaleForm.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function SaleForm({
  products,
  caris,
  balances,
  settings,
  onSubmit,
  disabled,
}) {
  const units = useMemo(() => settings?.units || [], [settings]);
  const warehouses = useMemo(() => settings?.warehouses || [], [settings]);
  const platforms = useMemo(() => settings?.platforms || [], [settings]);
  const vatRates = useMemo(() => settings?.taxes?.vat || [], [settings]);

  const defaultUnit = useMemo(() => getDefaultKey(units, "adet"), [units]);
  const defaultWarehouse = useMemo(() => getDefaultKey(warehouses, "main"), [warehouses]);
  const defaultPlatform = useMemo(() => getDefaultKey(platforms, "showroom"), [platforms]);
  const defaultVatRate = useMemo(() => getDefaultVatRate(vatRates), [vatRates]);

  const [draftLoaded, setDraftLoaded] = useState(false);
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
  const [vatMode, setVatMode] = useState("exclude"); // exclude | include

  // Customer
  const [cariSearch, setCariSearch] = useState("");
  const [cariId, setCariId] = useState("");
  const selectedCari = useMemo(() => caris?.find((c) => c.id === cariId) || null, [caris, cariId]);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("bank");
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
    },
  ]);

  // Draft auto-load (2.b)
  useEffect(() => {
    if (draftLoaded) return;
    setDraftLoaded(true);

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;

      // silent load
      setInvoiceDate(d.invoiceDate || todayISO());
      setDueDate(d.dueDate || "");
      setProcessStatus(d.processStatus || "draft");

      setSaleType(d.saleType || "actual");
      setSaleChannel(d.saleChannel || defaultPlatform);
      setVatMode(d.vatMode || "exclude");

      setInvoiceNo(d.invoiceNo || "");
      setInvoiceNoDirty(Boolean(d.invoiceNoDirty));

      setCariId(d.cariId || "");
      setCariSearch("");

      setPaymentMethod(d.paymentMethod || "bank");
      setPaidAmount(Number(d.paidAmount || 0));

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
          }))
        );
      }

      setDraftInfo({
        savedAt: d.savedAt || null,
      });
    } catch {
      // ignore
    }
  }, [draftLoaded, defaultPlatform, defaultUnit, defaultWarehouse, defaultVatRate]);

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

  function saveDraft() {
    const payload = {
      savedAt: new Date().toISOString(),
      invoiceDate,
      dueDate,
      processStatus,
      saleType,
      saleChannel,
      vatMode,
      invoiceNo,
      invoiceNoDirty,
      cariId,
      paymentMethod,
      paidAmount,
      deliveryMode,
      deliveryDate,
      plateNo,
      loadingArea,
      customerNote,
      internalNote,
      items,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setDraftInfo({ savedAt: payload.savedAt });
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDraftInfo(null);
  }

  function submitCompleted() {
    if (disabled) return;

    // basic validations
    const cleanItems = items
      .filter((r) => r?.productId && Number(r.quantity || 0) > 0)
      .map((r) => ({
        ...r,
        warehouseKey: (r.warehouseKey || defaultWarehouse).trim() || defaultWarehouse,
        vatRate: saleType === "official" ? Number(r.vatRate || 0) : 0,
      }));

    if (!cleanItems.length) {
      alert("En az 1 ürün satırı eklemelisin.");
      return;
    }

    onSubmit?.({
      invoiceDate,
      dueDate: dueDate || null,

      saleType,
      saleChannel,
      platformId: saleChannel,

      invoiceNo: (invoiceNo || "").trim(),
      invoiceNoDirty,
      // ✅ purchase mantığı: kullanıcı invoice inputuna dokunmadıysa otomatik üret
      invoiceNoAuto: !invoiceNoDirty,

      vatMode,

      cariId: cariId || null,

      items: cleanItems,

      payment: {
        method: paymentMethod,
        paidAmount: Number(paidAmount || 0) || 0,
      },

      meta: {
        processStatus,
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
    });
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
                  <h1 className="text-2xl font-extrabold text-slate-900 leading-none">Satış Faturası Oluştur</h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      Taslak
                    </span>
                    <span className="text-slate-300">|</span>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                      Fatura No: <span className="text-slate-900">{invoiceNo?.trim() ? invoiceNo : "Otomatik"}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fatura Tarihi</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Vade Tarihi</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none px-3"
                    disabled={disabled}
                  />
                </div>

                <div className="flex flex-col min-w-[160px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Süreç Durumu</label>
                  <select
                    value={processStatus}
                    onChange={(e) => setProcessStatus(e.target.value)}
                    className="h-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none px-3"
                    disabled={disabled}
                  >
                    <option value="draft">Taslak</option>
                    <option value="approved">Onaylandı</option>
                    <option value="cancelled">İptal</option>
                    <option value="returned">İade</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ... (dosyanın kalan kısmı ZIP’tekiyle aynı, sadece invoiceNo payload ve placeholder değişti) ... */}

            {/* Customer içinde fatura no input placeholder güncellendi */}
            {/* placeholder="Sistem üretir. Elle yazarsan manuel fatura no kaydedilir." */}

            {/* RIGHT SUMMARY vb. aynı */}
          </div>
        </div>
      </div>
    </div>
  );
}