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
      invoiceNoAuto: !invoiceNoDirty, // ✅ EKLENDİ: satınalma mantığıyla aynı

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

            {draftInfo?.savedAt && (
              <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-bold">Taslak yüklendi.</span>
                  <span className="ml-2 text-blue-700 text-xs">(Kaydedilme: {new Date(draftInfo.savedAt).toLocaleString("tr-TR")})</span>
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
                        {w.productName || w.productId} ({w.warehouseKey}) – stok: {w.available}, istenen: {w.need}
                      </div>
                    ))}
                    {negativeStockWarnings.length > 3 && <div>+{negativeStockWarnings.length - 3} satır daha</div>}
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fatura No (Opsiyonel)</label>
                    <input
                      className="border border-slate-200 bg-white rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Sistem üretir. Elle yazarsan da sayaç yine tüketilir."
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
                  <label className={`flex-1 p-3 rounded-2xl border-2 cursor-pointer ${saleType === "official" ? "border-blue-600 bg-blue-50" : "border-slate-100 hover:border-slate-200"}`}>
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
                      <div className="text-[10px] text-slate-500">Yasal fatura + KDV</div>
                    </div>
                  </label>
                  <label className={`flex-1 p-3 rounded-2xl border-2 cursor-pointer ${saleType === "actual" ? "border-blue-600 bg-blue-50" : "border-slate-100 hover:border-slate-200"}`}>
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
                      <div className="text-[10px] text-slate-500">Dahili satış + KDV pasif</div>
                    </div>
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">KDV Modu</label>
                    <select
                      value={vatMode}
                      onChange={(e) => setVatMode(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold px-3"
                      disabled={disabled || vatDisabled}
                    >
                      <option value="exclude">Hariç (Net + KDV)</option>
                      <option value="include">Dahil (Fiyat KDV dahil)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">KDV</label>
                    <div className={`h-10 rounded-xl border px-3 flex items-center text-sm font-semibold ${vatDisabled ? "bg-slate-100 border-slate-200 text-slate-400" : "bg-white border-slate-200"}`}>
                      {vatDisabled ? "Pasif" : "Satır bazında"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="text-blue-700" size={18} />
                  <h3 className="font-bold text-slate-900">Satış Platformu</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(platforms || []).filter((p) => p?.active !== false).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setSaleChannel(p.key)}
                      className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${saleChannel === p.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                      disabled={disabled}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Items */}
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
                <h3 className="font-bold text-slate-900">Lojistik ve Teslimat</h3>
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
                    className={`px-6 py-2 text-sm font-bold border-b-2 ${deliveryMode === k ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                    disabled={disabled}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teslim Tarihi</label>
                  <input
                    className="mt-2 w-full border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Araç Plakası</label>
                  <input
                    className="mt-2 w-full border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                    placeholder="Plaka No (Opsiyonel)"
                    value={plateNo}
                    onChange={(e) => setPlateNo(e.target.value)}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Yükleme Alanı</label>
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
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Müşteri Notları</label>
                    <textarea
                      className="w-full mt-1 border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                      placeholder="Şartlar, garanti bilgisi..."
                      rows={2}
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Dahili Notlar</label>
                    <textarea
                      className="w-full mt-1 border border-slate-200 bg-slate-50 rounded-xl text-sm px-3 py-2"
                      placeholder="Özel yönetici yorumları..."
                      rows={2}
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileDown className="text-blue-700" size={18} />
                  <h3 className="font-bold text-slate-900">Ek Dosyalar</h3>
                </div>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-500">
                  <p className="text-sm font-bold">Dosya yükleme (sonraki adım)</p>
                  <p className="text-xs mt-1">Sözleşme, Sertifika vb. (Maks 10MB)</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SUMMARY */}
          <div className="col-span-12 lg:col-span-3">
            <div className="sticky top-6 flex flex-col gap-6 max-h-[calc(100vh-48px)]">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-6 bg-slate-900 text-white">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Genel Toplam</p>
                  <h2 className="text-4xl font-black mt-1">{fmtMoney(totals.total)} ₸</h2>
                  <p className={`text-[10px] mt-2 font-bold flex items-center gap-1 uppercase tracking-tighter ${vatDisabled ? "text-slate-300" : "text-emerald-300"}`}>
                    <BadgeCheck size={14} />
                    {vatDisabled ? "KDV Pasif" : `KDV ${vatMode === "include" ? "Dahil" : "Hariç"}`}
                  </p>
                </div>

                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Ara Toplam</span>
                      <span className="text-slate-900 font-bold">{fmtMoney(totals.net)} ₸</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">KDV Toplamı</span>
                      <span className="text-slate-900 font-bold">{fmtMoney(vatDisabled ? 0 : totals.vat)} ₸</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Toplam İndirim</span>
                      <span className="text-red-500 font-bold">-{fmtMoney(totals.discount)} ₸</span>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Ödeme Yöntemi</label>
                      <select
                        className="mt-1 w-full border border-slate-200 bg-slate-50 rounded-xl text-sm font-bold px-3 py-2"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={disabled}
                      >
                        <option value="bank">Banka Havalesi</option>
                        <option value="cash">Nakit</option>
                        <option value="kaspi">Kaspi Pay</option>
                        <option value="card">Kart</option>
                        <option value="installment">Taksit</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Ödenen Tutar</label>
                        <input
                          className="mt-1 w-full border border-slate-200 bg-slate-50 rounded-xl text-sm font-extrabold text-emerald-600 px-3 py-2"
                          type="number"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(Number(e.target.value))}
                          disabled={disabled}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Kalan Bakiye</label>
                        <div className="mt-1 h-[40px] flex items-center px-3 bg-slate-100 rounded-xl text-sm font-extrabold text-slate-900">
                          {fmtMoney(remaining)} ₸
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 space-y-3">
                  <button
                    type="button"
                    onClick={submitCompleted}
                    disabled={disabled}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <BadgeCheck size={18} /> Onayla ve Tamamla
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={saveDraft}
                      disabled={disabled}
                      className="py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <Save size={16} /> Taslağı Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("PDF çıktısı: sonraki adım")} // placeholder
                      disabled={disabled}
                      className="py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <FileDown size={16} /> Yazdır (PDF)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => alert("Paylaş: sonraki adım")}
                    disabled={disabled}
                    className="w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Send size={16} /> Paylaş
                  </button>
                </div>
              </div>

              {/* Optional: credit warning placeholder */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                <div className="flex gap-3">
                  <AlertTriangle className="text-blue-700" size={18} />
                  <div>
                    <p className="text-xs font-bold text-blue-800">Cari uyarı alanı</p>
                    <p className="text-[10px] text-blue-700 leading-relaxed mt-1">
                      Limit / vade / risk uyarıları için hazır alan. (Sonraki adım)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}