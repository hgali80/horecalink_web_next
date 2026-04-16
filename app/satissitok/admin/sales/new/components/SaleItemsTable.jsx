// app/satissitok/admin/sales/new/components/SaleItemsTable.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, GripVertical, PlusCircle, Trash2 } from "lucide-react";
import { buildProductSnapshot } from "@/app/satissitok/services/inventoryCatalogService";

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function fmtMoney(n) {
  const x = num(n);
  return x.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function filterProducts(products, queryText) {
  const q = String(queryText || "").trim().toLowerCase();
  return (products || []).filter((p) => {
    if (!q) return true;
    const name = String(p?.name || p?.title || p?.productName || "").toLowerCase();
    const id = String(p?.id || "").toLowerCase();
    const sku = String(p?.sku || p?.stockCode || p?.code || "").toLowerCase();
    const barcode = String(p?.barcode || "").toLowerCase();
    return name.includes(q) || id.includes(q) || sku.includes(q) || barcode.includes(q);
  });
}

function getAvailableQty({ balances, productId, warehouseKey, bucketKey }) {
  const data = balances?.[productId] || {};
  const wh = data?.warehouses?.[warehouseKey]?.[bucketKey];
  const legacy = data?.[bucketKey];
  return num(wh?.qty ?? legacy?.qty ?? 0);
}

function getAvgCost({ balances, productId, warehouseKey, saleType }) {
  const data = balances?.[productId] || {};
  const wh = data?.warehouses?.[warehouseKey] || {};
  const official = wh?.official || data?.official || {};
  const actual = wh?.actual || data?.actual || {};

  if (saleType === "official") {
    return num(official?.avgCost ?? 0);
  }

  const actualQty = num(actual?.qty ?? 0);
  const actualAvg = num(actual?.avgCost ?? 0);
  const officialAvg = num(official?.avgCost ?? 0);

  return actualQty <= 0 && officialAvg > 0 ? officialAvg : actualAvg;
}

function calcRow({ row, saleType, vatMode }) {
  const qty = Math.max(0, num(row.quantity));
  const unitPrice = Math.max(0, num(row.unitPrice));
  const discountRate = Math.min(100, Math.max(0, num(row.discountRate)));

  const line = qty * unitPrice;
  const discounted = line * (1 - discountRate / 100);

  if (saleType !== "official") {
    return {
      net: round2(discounted),
      vat: 0,
      total: round2(discounted),
    };
  }

  const vatRate = Math.max(0, num(row.vatRate));
  const k = 1 + vatRate / 100;

  if (vatMode === "include") {
    const net = discounted / k;
    const vat = discounted - net;
    return {
      net: round2(net),
      vat: round2(vat),
      total: round2(discounted),
    };
  }

  const net = discounted;
  const vat = net * (vatRate / 100);
  const total = net + vat;
  return {
    net: round2(net),
    vat: round2(vat),
    total: round2(total),
  };
}

function normalizeRow(
  row,
  { defaultUnit, defaultWarehouse, defaultVatRate, saleType, vatMode }
) {
  const safe = {
    productId: row?.productId || "",
    productName: row?.productName || "",
    productSnapshot: row?.productSnapshot || null,
    unit: row?.unit || defaultUnit,
    warehouseKey: row?.warehouseKey || defaultWarehouse,
    quantity: Math.max(0, num(row?.quantity || 0)) || 1,
    unitPrice: Math.max(0, num(row?.unitPrice || 0)),
    discountRate: Math.min(100, Math.max(0, num(row?.discountRate || 0))),
    vatRate:
      saleType === "official"
        ? Math.max(0, num(row?.vatRate ?? defaultVatRate))
        : 0,
    net: num(row?.net || 0),
    vat: num(row?.vat || 0),
    total: num(row?.total || 0),
    purchaseUnitCost: Math.max(
      0,
      num(row?.purchaseUnitCost ?? row?.costAtSale ?? 0)
    ),
  };

  const calc = calcRow({ row: safe, saleType, vatMode });
  return { ...safe, ...calc };
}

function makeEmptyRow({ defaultUnit, defaultWarehouse, defaultVatRate }) {
  return {
    productId: "",
    productName: "",
    productSnapshot: null,
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
  };
}

export default function SaleItemsTable({
  products,
  balances,
  items,
  setItems,
  saleType,
  vatMode,
  units,
  warehouses,
  vatRates,
  defaultUnit,
  defaultWarehouse,
  defaultVatRate,
  disabled,
  showPurchaseCost = false,
  allowPurchaseCostEdit = false,
}) {
  const bucketKey = saleType === "official" ? "official" : "actual";

  const productById = useMemo(() => {
    const m = {};
    for (const p of products || []) m[p.id] = p;
    return m;
  }, [products]);

  const [openIndex, setOpenIndex] = useState(-1);
  const [queryByIndex, setQueryByIndex] = useState({});
  const closeTimerRef = useRef(null);

  const inputRefs = useRef({});
  const [ddPos, setDdPos] = useState({ top: 0, left: 0, width: 520 });

  function setQuery(i, v) {
    setQueryByIndex((prev) => ({ ...prev, [i]: v }));
  }

  function closeDropdownSoon() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpenIndex(-1), 120);
  }

  function productLabel(p) {
    return String(p?.name || p?.title || p?.productName || p?.id || "");
  }

  function currentRowLabel(row) {
    const p = productById?.[row.productId];
    return productLabel(p) || String(row.productName || "");
  }

  function getRowUnitOptions(row) {
    const base = Array.isArray(units) ? [...units] : [];
    const selectedUnit = String(row?.unit || "").trim();

    if (!selectedUnit) return base;

    const exists = base.some(
      (u) => String(u?.key || "").trim() === selectedUnit
    );

    if (exists) return base;

    return [
      ...base,
      {
        key: selectedUnit,
        name: selectedUnit,
        label: selectedUnit,
      },
    ];
  }

  function updateRow(i, patch) {
    setItems((prev) => {
      const next = [...prev];
      const base = normalizeRow(next[i] || {}, {
        defaultUnit,
        defaultWarehouse,
        defaultVatRate,
        saleType,
        vatMode,
      });
      const row = { ...base, ...patch };

      if (saleType !== "official") {
        row.vatRate = 0;
      }

      const calc = calcRow({ row, saleType, vatMode });
      next[i] = { ...row, ...calc };
      return next;
    });
  }

  function removeRow(i) {
    setItems((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length > 0) return next;
      return [
        makeEmptyRow({
          defaultUnit,
          defaultWarehouse,
          defaultVatRate,
        }),
      ];
    });
  }

  function addRow() {
    setItems((prev) => [
      ...prev,
      makeEmptyRow({
        defaultUnit,
        defaultWarehouse,
        defaultVatRate: saleType === "official" ? defaultVatRate : 0,
      }),
    ]);
  }

  function duplicateRow(i) {
    setItems((prev) => {
      const base = normalizeRow(prev[i] || {}, {
        defaultUnit,
        defaultWarehouse,
        defaultVatRate,
        saleType,
        vatMode,
      });
      const next = [...prev];
      next.splice(i + 1, 0, { ...base });
      return next;
    });
  }

  function updateDdPosForIndex(idx) {
    const el = inputRefs.current[idx];
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDdPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  function pickProduct(i, p) {
    const label = productLabel(p);
    const warehouseKey = items?.[i]?.warehouseKey || defaultWarehouse;

    const defaultPurchaseUnitCost = getAvgCost({
      balances,
      productId: p.id,
      warehouseKey,
      saleType,
    });

    const firestoreUnit =
      p?.unit || p?.unitKey || p?.saleUnit || p?.barcodeUnit || "";

    const patch = {
      productId: p.id,
      productName: label,
      productSnapshot: buildProductSnapshot(p),
      unitPrice: num(p?.price || 0),
      unit: firestoreUnit || items?.[i]?.unit || defaultUnit,
      warehouseKey,
      vatRate:
        saleType === "official"
          ? Math.max(0, num(p?.vatRate ?? items?.[i]?.vatRate ?? defaultVatRate))
          : 0,
      purchaseUnitCost: Math.max(0, num(defaultPurchaseUnitCost)),
    };

    updateRow(i, patch);
    setQuery(i, label);
    setOpenIndex(-1);
  }

  useEffect(() => {
    setItems((prev) =>
      (prev || []).map((row) =>
        normalizeRow(row, {
          defaultUnit,
          defaultWarehouse,
          defaultVatRate,
          saleType,
          vatMode,
        })
      )
    );
  }, [setItems, saleType, vatMode, defaultUnit, defaultWarehouse, defaultVatRate]);

  useEffect(() => {
    const onScrollOrResize = () => {
      if (openIndex === -1) return;
      updateDdPosForIndex(openIndex);
    };

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [openIndex]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (disabled) return;
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setItems((prev) => [
          ...prev,
          makeEmptyRow({
            defaultUnit,
            defaultWarehouse,
            defaultVatRate: saleType === "official" ? defaultVatRate : 0,
          }),
        ]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [defaultUnit, defaultWarehouse, defaultVatRate, disabled, saleType, setItems]);

  const totals = useMemo(() => {
    const sum = { net: 0, vat: 0, total: 0 };
    for (const r of items || []) {
      sum.net += num(r.net);
      sum.vat += num(r.vat);
      sum.total += num(r.total);
    }
    sum.net = round2(sum.net);
    sum.vat = round2(sum.vat);
    sum.total = round2(sum.total);
    return sum;
  }, [items]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-visible">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="font-semibold text-slate-800">Fatura Satırları</div>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <PlusCircle className="w-4 h-4" />
          Satır Ekle (Alt+N)
        </button>
      </div>

      <div className="p-3 md:p-4 space-y-3">
        {(items || []).map((row, i) => {
          const warehouseKey = row.warehouseKey || defaultWarehouse;

          const avail = row.productId
            ? getAvailableQty({
                balances,
                productId: row.productId,
                warehouseKey,
                bucketKey,
              })
            : 0;

          const computedPurchaseUnitCost = row.productId
            ? getAvgCost({
                balances,
                productId: row.productId,
                warehouseKey,
                saleType,
              })
            : 0;

          const purchaseUnitCost = num(
            row.purchaseUnitCost ?? computedPurchaseUnitCost
          );

          const rowUnitOptions = getRowUnitOptions(row);
          const stockGap = Math.max(num(row.quantity) - avail, 0);
          const lineProfit = round2(num(row.total) - num(row.quantity) * purchaseUnitCost);

          return (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
            >
              <div className="p-3 md:p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="pt-2 text-slate-400 hidden md:block">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <input
                        ref={(el) => (inputRefs.current[i] = el)}
                        className="w-full text-sm md:text-base font-bold bg-white border border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={queryByIndex[i] ?? currentRowLabel(row)}
                        onFocus={() => {
                          updateDdPosForIndex(i);
                          if (queryByIndex[i] == null) {
                            setQuery(i, currentRowLabel(row));
                          }
                          setOpenIndex(i);
                        }}
                        onChange={(e) => {
                          updateDdPosForIndex(i);
                          const v = e.target.value;
                          setQuery(i, v);
                          setOpenIndex(i);
                          if (!v) {
                            updateRow(i, {
                              productId: "",
                              productName: "",
                              productSnapshot: null,
                              unitPrice: 0,
                              discountRate: 0,
                              vatRate: saleType === "official" ? defaultVatRate : 0,
                              net: 0,
                              vat: 0,
                              total: 0,
                              purchaseUnitCost: 0,
                            });
                          }
                        }}
                        onBlur={() => closeDropdownSoon()}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setOpenIndex(-1);
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const q = String(
                              queryByIndex[i] ?? currentRowLabel(row)
                            )
                              .trim()
                              .toLowerCase();

                            const list = filterProducts(products, q).slice(0, 1);

                            if (list[0]) pickProduct(i, list[0]);
                          }
                        }}
                        placeholder="Ürün ara / seç…"
                        disabled={disabled}
                      />

                      {openIndex === i && (
                        <div
                          className="fixed z-[9999] max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                          style={{
                            top: ddPos.top,
                            left: ddPos.left,
                            width: Math.max(360, ddPos.width),
                          }}
                        >
                          {(() => {
                            const q = String(
                              queryByIndex[i] ?? currentRowLabel(row)
                            )
                              .trim()
                              .toLowerCase();

                            const list = filterProducts(products, q).slice(0, 80);

                            if (!list.length) {
                              return (
                                <div className="px-3 py-2 text-sm text-slate-500">
                                  Sonuç yok
                                </div>
                              );
                            }

                            return list.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickProduct(i, p)}
                              >
                                <div className="font-medium">
                                  {productLabel(p)}
                                </div>
                                <div className="text-xs text-slate-400">
                                  SKU: {p.id || "-"}{" "}
                                  {(p?.unit || p?.unitKey) ? `• Birim: ${p?.unit || p?.unitKey}` : ""}
                                </div>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 font-semibold">
                        Satir #{i + 1}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1">
                        SKU: {row.productId || "-"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 ${
                          stockGap > 0 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        Stok: {fmtMoney(avail)}
                        {stockGap > 0 ? ` • Eksik ${fmtMoney(stockGap)}` : " • Yeterli"}
                      </span>
                      {showPurchaseCost && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-1">
                          Alış: {fmtMoney(purchaseUnitCost)}
                        </span>
                      )}
                      {showPurchaseCost && row.productId && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 ${
                            lineProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          Kar: {fmtMoney(lineProfit)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => duplicateRow(i)}
                      disabled={disabled || !row.productId}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 disabled:opacity-30"
                      title="Satiri kopyala"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={disabled || (items || []).length <= 1}
                      className="p-2 rounded-xl hover:bg-red-50 text-red-600 disabled:opacity-30"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">
                      Depo
                    </div>
                    <select
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={row.warehouseKey || defaultWarehouse}
                      onChange={(e) =>
                        updateRow(i, { warehouseKey: e.target.value })
                      }
                      disabled={disabled}
                    >
                      {(warehouses || []).map((w) => (
                        <option key={w.key} value={w.key}>
                          {w.name || w.label || w.key}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">
                      Birim
                    </div>
                    <select
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={row.unit || defaultUnit}
                      onChange={(e) => updateRow(i, { unit: e.target.value })}
                      disabled={disabled}
                    >
                      {rowUnitOptions.map((u) => (
                        <option key={u.key} value={u.key}>
                          {u.name || u.label || u.key}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">
                      Miktar
                    </div>
                    <input
                      className="w-full text-right text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: e.target.value })}
                      disabled={disabled}
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">
                      Birim Fiyat
                    </div>
                    <input
                      className="w-full text-right text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitPrice}
                      onChange={(e) =>
                        updateRow(i, { unitPrice: e.target.value })
                      }
                      disabled={disabled}
                    />
                  </label>

                  {showPurchaseCost && (
                    <label className="block">
                      <div className="mb-1 text-[11px] font-semibold text-slate-500">
                        Alış Fiyatı
                      </div>
                      {allowPurchaseCostEdit ? (
                        <input
                          className="w-full text-right text-xs border border-amber-200 rounded-xl px-3 py-2.5 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          type="number"
                          min="0"
                          step="0.01"
                          value={purchaseUnitCost}
                          onChange={(e) =>
                            updateRow(i, { purchaseUnitCost: e.target.value })
                          }
                          disabled={disabled}
                        />
                      ) : (
                        <div className="w-full text-right text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50">
                          {fmtMoney(purchaseUnitCost)}
                        </div>
                      )}
                    </label>
                  )}

                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">
                      İskonto %
                    </div>
                    <input
                      className="w-full text-right text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.discountRate}
                      onChange={(e) =>
                        updateRow(i, { discountRate: e.target.value })
                      }
                      disabled={disabled}
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">
                      KDV %
                    </div>
                    <select
                      className="w-full text-right text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={
                        saleType === "official"
                          ? row.vatRate ?? defaultVatRate
                          : 0
                      }
                      onChange={(e) => updateRow(i, { vatRate: e.target.value })}
                      disabled={disabled || saleType !== "official"}
                    >
                      {(vatRates || []).map((v) => (
                        <option key={v.rate} value={v.rate}>
                          {v.rate}%
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="block">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">
                      Toplam
                    </div>
                    <div className="w-full text-right text-sm font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900">
                      {fmtMoney(row.total)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <div className="text-[11px] text-slate-500 mb-1">
                      Ara Toplam
                    </div>
                    <div className="text-sm font-semibold text-right">
                      {fmtMoney(row.net)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <div className="text-[11px] text-slate-500 mb-1">KDV</div>
                    <div className="text-sm font-semibold text-right">
                      {fmtMoney(row.vat)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2">
                    <div className="text-[11px] text-blue-700 mb-1">
                      Genel Toplam
                    </div>
                    <div className="text-base font-bold text-right text-blue-900">
                      {fmtMoney(row.total)}
                    </div>
                  </div>
                </div>

                {row.productId && stockGap > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Bu satir secilen depo icin mevcut stoktan {fmtMoney(stockGap)} fazla.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Toplam Ara Toplam</div>
              <div className="text-lg font-bold text-right">
                {fmtMoney(totals.net)}
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Toplam KDV</div>
              <div className="text-lg font-bold text-right">
                {fmtMoney(totals.vat)}
              </div>
            </div>

            <div className="rounded-xl bg-blue-600 text-white border border-blue-600 px-4 py-3">
              <div className="text-xs text-blue-100 mb-1">
                Genel Toplam • {(items || []).filter((x) => x?.productId).length} satir
              </div>
              <div className="text-xl font-extrabold text-right">
                {fmtMoney(totals.total)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
