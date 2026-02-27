// app/satissitok/admin/sales/new/components/SaleItemsTable.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, PlusCircle, Trash2 } from "lucide-react";

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

function getAvailableQty({ balances, productId, warehouseKey, bucketKey }) {
  const data = balances?.[productId] || {};
  const wh = data?.warehouses?.[warehouseKey]?.[bucketKey];
  const legacy = data?.[bucketKey];
  return num(wh?.qty ?? legacy?.qty ?? 0);
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

  // exclude
  const net = discounted;
  const vat = net * (vatRate / 100);
  const total = net + vat;
  return {
    net: round2(net),
    vat: round2(vat),
    total: round2(total),
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

  // ✅ Dropdown fixed konumlandırma
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
    return String(p?.name || p?.title || p?.id || "");
  }

  function currentRowLabel(row) {
    const p = productById?.[row.productId];
    return productLabel(p) || String(row.productName || "");
  }

  function updateRow(i, patch) {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[i], ...patch };
      const calc = calcRow({ row, saleType, vatMode });
      next[i] = { ...row, ...calc };
      return next;
    });
  }

  function removeRow(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addRow() {
    setItems((prev) => [
      ...prev,
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
  }

  function updateDdPosForIndex(idx) {
    const el = inputRefs.current[idx];
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDdPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  function pickProduct(i, p) {
    const label = productLabel(p);
    updateRow(i, {
      productId: p.id,
      productName: label,
      unitPrice: num(p?.price || 0),
    });
    setQuery(i, label);
    setOpenIndex(-1);
  }

  // Recalc when saleType/vatMode changes
  useEffect(() => {
    setItems((prev) =>
      prev.map((row) => {
        const calc = calcRow({ row, saleType, vatMode });
        return { ...row, ...calc };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleType, vatMode]);

  // ✅ Scroll/resize olunca dropdown inputu takip etsin
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

      <div className="overflow-x-auto relative">
        <table className="min-w-[2400px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="w-10 px-3 py-3 text-left"></th>
              <th className="px-4 py-3 text-left">Ürün</th>
              <th className="px-4 py-3 text-left">Depo</th>
              <th className="px-4 py-3 text-left">Birim</th>
              <th className="px-4 py-3 text-right">Miktar</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3 text-right">Birim Fiyat</th>
              <th className="px-4 py-3 text-right">İskonto %</th>
              <th className="px-4 py-3 text-right">KDV %</th>
              <th className="px-4 py-3 text-right">Ara Toplam</th>
              <th className="px-4 py-3 text-right">KDV</th>
              <th className="px-4 py-3 text-right">Toplam</th>
              <th className="w-10 px-3 py-3 text-right"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {(items || []).map((row, i) => {
              const avail = row.productId
                ? getAvailableQty({
                    balances,
                    productId: row.productId,
                    warehouseKey: row.warehouseKey || defaultWarehouse,
                    bucketKey,
                  })
                : 0;

              return (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-3 text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {/* ✅ Searchable product picker (fixed dropdown, kırpılmaz) */}
                      <div className="relative">
                        <input
                          ref={(el) => (inputRefs.current[i] = el)}
                          className="w-full text-sm font-bold bg-transparent border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={queryByIndex[i] ?? currentRowLabel(row)}
                          onFocus={() => {
                            updateDdPosForIndex(i);
                            if (queryByIndex[i] == null) setQuery(i, currentRowLabel(row));
                            setOpenIndex(i);
                          }}
                          onChange={(e) => {
                            updateDdPosForIndex(i);
                            const v = e.target.value;
                            setQuery(i, v);
                            setOpenIndex(i);
                            if (!v) {
                              updateRow(i, { productId: "", productName: "" });
                            }
                          }}
                          onBlur={() => closeDropdownSoon()}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setOpenIndex(-1);
                            }
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const q = String(queryByIndex[i] ?? currentRowLabel(row))
                                .trim()
                                .toLowerCase();
                              const list = (products || [])
                                .filter((p) => {
                                  const label = productLabel(p).toLowerCase();
                                  const id = String(p.id || "").toLowerCase();
                                  if (!q) return true;
                                  return label.includes(q) || id.includes(q);
                                })
                                .slice(0, 1);
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
                              const q = String(queryByIndex[i] ?? currentRowLabel(row))
                                .trim()
                                .toLowerCase();

                              const list = (products || [])
                                .filter((p) => {
                                  const label = productLabel(p).toLowerCase();
                                  const id = String(p.id || "").toLowerCase();
                                  if (!q) return true;
                                  return label.includes(q) || id.includes(q);
                                })
                                .slice(0, 80);

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
                                  {productLabel(p)}
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400">SKU: {row.productId || "-"}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <select
                      className="text-xs bg-transparent border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={row.warehouseKey || defaultWarehouse}
                      onChange={(e) => updateRow(i, { warehouseKey: e.target.value })}
                      disabled={disabled}
                    >
                      {(warehouses || []).map((w) => (
                        <option key={w.key} value={w.key}>
                          {w.name || w.key}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3">
                    <select
                      className="text-xs bg-transparent border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={row.unit || defaultUnit}
                      onChange={(e) => updateRow(i, { unit: e.target.value })}
                      disabled={disabled}
                    >
                      {(units || []).map((u) => (
                        <option key={u.key} value={u.key}>
                          {u.name || u.key}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <input
                      className="w-24 text-right text-xs border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: e.target.value })}
                      disabled={disabled}
                    />
                  </td>

                  <td className="px-4 py-3 text-right text-xs">{fmtMoney(avail)}</td>

                  <td className="px-4 py-3 text-right">
                    <input
                      className="w-28 text-right text-xs border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                      disabled={disabled}
                    />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <input
                      className="w-20 text-right text-xs border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      type="number"
                      value={row.discountRate}
                      onChange={(e) => updateRow(i, { discountRate: e.target.value })}
                      disabled={disabled}
                    />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <select
                      className="w-20 text-right text-xs bg-transparent border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={row.vatRate ?? defaultVatRate}
                      onChange={(e) => updateRow(i, { vatRate: e.target.value })}
                      disabled={disabled || saleType !== "official"}
                    >
                      {(vatRates || []).map((v) => (
                        <option key={v.rate} value={v.rate}>
                          {v.rate}%
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3 text-right text-xs">{fmtMoney(row.net)}</td>
                  <td className="px-4 py-3 text-right text-xs">{fmtMoney(row.vat)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtMoney(row.total)}</td>

                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={disabled || (items || []).length <= 1}
                      className="p-2 rounded-xl hover:bg-red-50 text-red-600 disabled:opacity-30"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={9} className="px-4 py-3 text-right text-slate-600">
                Toplamlar
              </td>
              <td className="px-4 py-3 text-right font-semibold">{fmtMoney(totals.net)}</td>
              <td className="px-4 py-3 text-right font-semibold">{fmtMoney(totals.vat)}</td>
              <td className="px-4 py-3 text-right font-semibold">{fmtMoney(totals.total)}</td>
              <td className="px-3 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}