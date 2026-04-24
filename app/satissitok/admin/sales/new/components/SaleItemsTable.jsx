"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { buildProductSnapshot } from "@/app/satissitok/services/inventoryCatalogService";
import {
  buildLatestCostIndex,
  listProductCostEntries,
} from "@/app/satissitok/services/inventoryCostService";

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

function resolveSaleVatRate(primaryRate, fallbackRate, defaultVatRate) {
  const primary = num(primaryRate);
  if (primary > 0) return primary;

  const fallback = num(fallbackRate);
  if (fallback > 0) return fallback;

  return Math.max(0, num(defaultVatRate));
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
  const factor = 1 + vatRate / 100;

  if (vatMode === "include") {
    const net = discounted / factor;
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
  const resolvedVatRate = Math.max(0, num(row?.vatRate ?? defaultVatRate));
  const safe = {
    productId: row?.productId || "",
    productName: row?.productName || "",
    productSnapshot: row?.productSnapshot || null,
    unit: row?.unit || defaultUnit,
    warehouseKey: row?.warehouseKey || defaultWarehouse,
    quantity: Math.max(0, Math.round(num(row?.quantity || 0))) || 1,
    unitPrice: Math.max(0, num(row?.unitPrice || 0)),
    discountRate: Math.min(100, Math.max(0, num(row?.discountRate || 0))),
    vatRate: resolvedVatRate,
    net: num(row?.net || 0),
    vat: num(row?.vat || 0),
    total: num(row?.total || 0),
    purchaseUnitCost: Math.max(0, num(row?.purchaseUnitCost ?? row?.costAtSale ?? 0)),
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

function getDateMs(v) {
  if (!v) return 0;
  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 0 : v.getTime();
  if (typeof v === "number") return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
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
  const [costEntries, setCostEntries] = useState([]);

  const productById = useMemo(() => {
    const map = {};
    for (const p of products || []) map[p.id] = p;
    return map;
  }, [products]);

  const warehouseByKey = useMemo(() => {
    const map = {};
    for (const w of warehouses || []) map[w.key] = w;
    return map;
  }, [warehouses]);

  const latestCostIndex = useMemo(
    () => buildLatestCostIndex(costEntries),
    [costEntries]
  );

  const [openIndex, setOpenIndex] = useState(-1);
  const [queryByIndex, setQueryByIndex] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const closeTimerRef = useRef(null);
  const inputRefs = useRef({});
  const [ddPos, setDdPos] = useState({ top: 0, left: 0, width: 520 });

  useEffect(() => {
    let ignore = false;

    async function loadCosts() {
      try {
        const entries = await listProductCostEntries();
        if (!ignore) setCostEntries(entries);
      } catch (error) {
        if (!ignore) {
          console.warn("LATEST_COST_LOAD_ERROR:", error);
          setCostEntries([]);
        }
      }
    }

    loadCosts();
    return () => {
      ignore = true;
    };
  }, []);

  function setQuery(i, value) {
    setQueryByIndex((prev) => ({ ...prev, [i]: value }));
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

    const exists = base.some((u) => String(u?.key || "").trim() === selectedUnit);
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

  function findLatestPurchaseInfo(productId) {
    const key = String(productId || "").trim();
    if (!key) return null;

    const entry = latestCostIndex?.[`${key}__default`] || null;
    if (!entry) return null;

    return {
      unitPrice: round2(num(entry.grossUnitCost ?? entry.unitPrice)),
      dateValue: entry.documentDate || entry.createdAt || null,
      dateMs: getDateMs(entry.documentDate || entry.createdAt || null),
      docNo: entry.invoiceNo || "",
    };
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
        defaultVatRate,
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

  function toggleRowDetails(index) {
    setExpandedRows((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function updateDdPosForIndex(index) {
    const el = inputRefs.current[index];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDdPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }

  function pickProduct(i, p) {
    const label = productLabel(p);
    const warehouseKey = items?.[i]?.warehouseKey || defaultWarehouse;
    const latestPurchase = findLatestPurchaseInfo(p.id);
    const defaultPurchaseUnitCost =
      latestPurchase?.unitPrice ??
      getAvgCost({
        balances,
        productId: p.id,
        warehouseKey,
        saleType,
      });
    const firestoreUnit = p?.unit || p?.unitKey || p?.saleUnit || p?.barcodeUnit || "";

    updateRow(i, {
      productId: p.id,
      productName: label,
      productSnapshot: buildProductSnapshot(p),
      unitPrice: num(p?.price || 0),
      unit: firestoreUnit || items?.[i]?.unit || defaultUnit,
      warehouseKey,
      vatRate: resolveSaleVatRate(
        p?.vatRate,
        items?.[i]?.vatRate,
        defaultVatRate
      ),
      purchaseUnitCost: Math.max(0, num(defaultPurchaseUnitCost)),
    });

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
    if (saleType !== "official") return;
    if (num(defaultVatRate) <= 0) return;

    setItems((prev) =>
      (prev || []).map((row) => {
        if (!row?.productId) return row;
        if (num(row?.vatRate) > 0) return row;
        return normalizeRow(
          {
            ...row,
            vatRate: defaultVatRate,
          },
          {
            defaultUnit,
            defaultWarehouse,
            defaultVatRate,
            saleType,
            vatMode,
          }
        );
      })
    );
  }, [
    setItems,
    saleType,
    vatMode,
    defaultUnit,
    defaultWarehouse,
    defaultVatRate,
  ]);

  useEffect(() => {
    if (!latestCostIndex || Object.keys(latestCostIndex).length === 0) return;

    setItems((prev) =>
      (prev || []).map((row) => {
        if (!row?.productId) return row;
        if (num(row.purchaseUnitCost) > 0) return row;

        const entry = latestCostIndex?.[`${String(row.productId || "").trim()}__default`];
        if (!entry) return row;

        return {
          ...row,
          purchaseUnitCost: round2(num(entry.grossUnitCost ?? entry.unitPrice)),
        };
      })
    );
  }, [latestCostIndex, setItems]);

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
            defaultVatRate,
          }),
        ]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, defaultUnit, defaultWarehouse, defaultVatRate, saleType, setItems]);

  return (
    <div className="overflow-visible bg-transparent">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Urun / Hizmet
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Miktar
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Son Alis
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Birim Fiyat
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Iskonto
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                KDV
              </th>
              <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Toplam
              </th>
              <th className="w-[120px] px-4 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
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
              const lineProfit = round2(
                num(row.total) - num(row.quantity) * purchaseUnitCost
              );
              const isExpanded = Boolean(expandedRows[i]);
              const warehouseLabel =
                warehouseByKey[row.warehouseKey || defaultWarehouse]?.name ||
                warehouseByKey[row.warehouseKey || defaultWarehouse]?.label ||
                row.warehouseKey ||
                defaultWarehouse;

              return (
                <Fragment key={i}>
                  <tr className="bg-white transition-colors hover:bg-slate-50/70">
                    <td className="px-6 py-5 align-top">
                      <div className="min-w-0">
                        <div className="relative">
                          <input
                            ref={(el) => {
                              inputRefs.current[i] = el;
                            }}
                            className="w-full rounded-lg border-0 bg-transparent p-0 text-sm font-bold text-slate-900 focus:outline-none focus:ring-0"
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
                              const value = e.target.value;
                              setQuery(i, value);
                              setOpenIndex(i);

                              if (!value) {
                                updateRow(i, {
                                  productId: "",
                                  productName: "",
                                  productSnapshot: null,
                                  unitPrice: 0,
                                  discountRate: 0,
                                  vatRate: defaultVatRate,
                                  net: 0,
                                  vat: 0,
                                  total: 0,
                                  purchaseUnitCost: 0,
                                });
                              }
                            }}
                            onBlur={closeDropdownSoon}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setOpenIndex(-1);
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
                            placeholder="Urun / hizmet sec..."
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
                                      Sonuc yok
                                    </div>
                                  );
                                }

                                return list.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pickProduct(i, p)}
                                  >
                                    <div className="font-medium">{productLabel(p)}</div>
                                    <div className="text-xs text-slate-400">
                                      SKU: {p.id || "-"}{" "}
                                      {p?.unit || p?.unitKey
                                        ? `• Birim: ${p?.unit || p?.unitKey}`
                                        : ""}
                                    </div>
                                  </button>
                                ));
                              })()}
                            </div>
                          )}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-500">
                          SKU: {row.productId || "-"}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5 align-top">
                      <div className="flex items-center gap-2">
                        <input
                          className="w-20 border-0 bg-transparent p-0 text-sm font-semibold focus:outline-none focus:ring-0"
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => updateRow(i, { quantity: e.target.value })}
                          disabled={disabled}
                        />
                        <span className="text-sm font-semibold text-slate-700">
                          {row.unit || defaultUnit || ""}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-5 align-top">
                      <div className="flex max-w-[120px] items-center gap-1 rounded bg-amber-50 px-2 py-1">
                        <input
                          className="w-full border-0 bg-transparent p-0 text-sm font-semibold focus:outline-none focus:ring-0"
                          type="number"
                          min="0"
                          step="0.01"
                          value={purchaseUnitCost}
                          onChange={(e) =>
                            updateRow(i, { purchaseUnitCost: e.target.value })
                          }
                          disabled={disabled}
                        />
                        <span className="text-sm font-medium text-slate-500">₸</span>
                      </div>
                    </td>

                    <td className="px-6 py-5 align-top">
                      <div className="flex max-w-[110px] items-center gap-1 rounded bg-slate-100 px-2 py-1">
                        <input
                          className="w-full border-0 bg-transparent p-0 text-sm font-semibold focus:outline-none focus:ring-0"
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.unitPrice}
                          onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                          disabled={disabled}
                        />
                        <span className="text-sm font-medium text-slate-500">₸</span>
                      </div>
                    </td>

                    <td className="px-6 py-5 align-top">
                      <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold">
                        %{num(row.discountRate)}
                      </span>
                    </td>

                    <td className="px-6 py-5 align-top">
                      <select
                        className="h-9 min-w-[88px] rounded-md border border-slate-200 bg-slate-50 px-2 text-sm font-semibold outline-none focus:border-slate-400"
                        value={saleType === "official" ? row.vatRate ?? defaultVatRate : 0}
                        onChange={(e) => updateRow(i, { vatRate: e.target.value })}
                        disabled={disabled || saleType !== "official"}
                      >
                        {saleType !== "official" ? (
                          <option value={0}>0%</option>
                        ) : (
                          (vatRates || []).map((v) => (
                            <option key={v.rate} value={v.rate}>
                              {v.rate}%
                            </option>
                          ))
                        )}
                      </select>
                    </td>

                    <td className="px-6 py-5 align-top text-right text-sm font-bold text-slate-900">
                      {fmtMoney(row.total)} ₸
                    </td>

                    <td className="px-4 py-5 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => toggleRowDetails(i)}
                          disabled={disabled}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          title={isExpanded ? "Detayi gizle" : "Detayi goster"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateRow(i)}
                          disabled={disabled || !row.productId}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
                          title="Satiri kopyala"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          disabled={disabled || (items || []).length <= 1}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 px-6 pb-5 pt-1">
                        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-5">
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-slate-500">
                              Depo
                            </div>
                            <select
                              className="w-full rounded-lg border-0 bg-slate-100 px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
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
                              className="w-full rounded-lg border-0 bg-slate-100 px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
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
                              KDV %
                            </div>
                            <select
                              className="w-full rounded-lg border-0 bg-slate-100 px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                              value={saleType === "official" ? row.vatRate ?? defaultVatRate : 0}
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

                          <div className="rounded-lg bg-slate-100 px-3 py-3">
                            <div className="mb-1 text-[11px] font-semibold text-slate-500">
                              Depo
                            </div>
                            <div className="text-sm font-semibold text-slate-800">
                              {warehouseLabel}
                            </div>
                          </div>

                          <div className="rounded-lg bg-slate-100 px-3 py-3">
                            <div className="mb-1 text-[11px] font-semibold text-slate-500">
                              Ara Toplam
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {fmtMoney(row.net)} ₸
                            </div>
                          </div>

                          {showPurchaseCost && (
                            <label className="block md:col-span-2">
                              <div className="mb-1 text-[11px] font-semibold text-slate-500">
                                Alis Fiyati
                              </div>
                              {allowPurchaseCostEdit ? (
                                <input
                                  className="w-full rounded-lg border-0 bg-amber-50 px-3 py-2.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                                <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                                  {fmtMoney(purchaseUnitCost)} ₸
                                </div>
                              )}
                            </label>
                          )}

                          {row.productId && stockGap > 0 && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 md:col-span-2">
                              Bu satir secilen depo icin mevcut stoktan {fmtMoney(stockGap)} fazla.
                            </div>
                          )}

                          {showPurchaseCost && row.productId && (
                            <div
                              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                                lineProfit >= 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              Kar: {fmtMoney(lineProfit)} ₸
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-5">
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="flex items-center gap-2 text-sm font-bold text-slate-950 transition hover:translate-x-1 disabled:opacity-40"
        >
          <PlusCircle className="h-5 w-5" />
          Yeni Satir Ekle
        </button>
      </div>
    </div>
  );
}
