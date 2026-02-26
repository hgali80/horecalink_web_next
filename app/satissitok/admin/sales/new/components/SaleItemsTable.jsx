// app/satissitok/admin/sales/new/components/SaleItemsTable.jsx
"use client";

import { useEffect } from "react";
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

  function updateRow(i, patch) {
    setItems((prev) => {
      const x = [...prev];
      const next = { ...x[i], ...patch };
      const calced = calcRow({ row: next, saleType, vatMode });
      x[i] = { ...next, ...calced };
      return x;
    });
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

  function removeRow(i) {
    setItems((prev) => {
      const x = prev.filter((_, idx) => idx !== i);
      return x.length ? x : prev; // at least 1 row
    });
  }

  // Alt+N
  useEffect(() => {
    function onKey(e) {
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        if (!disabled) addRow();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);

  // When saleType changes (official<->actual), recalc all and zero-out VAT if needed
  useEffect(() => {
    setItems((prev) =>
      prev.map((r) => {
        const next = {
          ...r,
          vatRate: saleType === "official" ? num(r.vatRate) : 0,
        };
        const calced = calcRow({ row: next, saleType, vatMode });
        return { ...next, ...calced };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleType, vatMode]);

  const activeUnits = (units || []).filter((u) => u?.active !== false);
  const activeWarehouses = (warehouses || []).filter((w) => w?.active !== false);
  const activeVatRates = (vatRates || []).filter((v) => v?.active !== false);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3">Ürün / SKU</th>
              <th className="px-4 py-3">Depo</th>
              <th className="px-4 py-3 text-center">Stok</th>
              <th className="px-4 py-3 w-20">Miktar</th>
              <th className="px-4 py-3 w-24">Birim</th>
              <th className="px-4 py-3 w-36">Birim Fiyat (₸)</th>
              <th className="px-4 py-3 w-24">İndirim%</th>
              <th className="px-4 py-3 w-24 text-slate-900">KDV%</th>
              <th className="px-4 py-3 text-right">Toplam</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {items.map((row, i) => {
              const whKey = (row.warehouseKey || defaultWarehouse).trim() || defaultWarehouse;
              const avail = row.productId
                ? getAvailableQty({ balances, productId: row.productId, warehouseKey: whKey, bucketKey })
                : 0;
              const need = num(row.quantity);
              const ok = !row.productId || need <= 0 || avail >= need;

              return (
                <tr key={i} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-4 py-3 text-slate-300">
                    <GripVertical size={18} className="cursor-grab active:cursor-grabbing" />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <select
                        className="text-sm font-bold bg-transparent border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={row.productId}
                        onChange={(e) => {
                          const id = e.target.value;
                          const p = (products || []).find((x) => x.id === id);
                          updateRow(i, {
                            productId: id,
                            productName: p?.name || p?.title || "",
                            unitPrice: num(p?.price || 0),
                          });
                        }}
                        disabled={disabled}
                      >
                        <option value="">Ürün seç…</option>
                        {(products || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.title || p.id}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400">SKU: {row.productId || "-"}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <select
                      className="text-xs bg-white border border-slate-200 rounded-xl px-2 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={whKey}
                      onChange={(e) => updateRow(i, { warehouseKey: e.target.value })}
                      disabled={disabled}
                    >
                      {activeWarehouses.map((w) => (
                        <option key={w.key} value={w.key}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div
                      className={`mx-auto w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
                      title={row.productId ? `Stok: ${avail}` : ""}
                    />
                    {row.productId && <div className="text-[10px] text-slate-400 mt-1">{avail}</div>}
                  </td>

                  <td className="px-4 py-3">
                    <input
                      className="w-20 text-sm font-bold text-center border border-slate-200 bg-white rounded-xl px-2 py-2"
                      type="number"
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: num(e.target.value) })}
                      disabled={disabled}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <select
                      className="text-xs bg-white border border-slate-200 rounded-xl px-2 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={row.unit || defaultUnit}
                      onChange={(e) => updateRow(i, { unit: e.target.value })}
                      disabled={disabled}
                    >
                      {activeUnits.map((u) => (
                        <option key={u.key} value={u.key}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3">
                    <input
                      className="w-36 text-sm font-bold border border-slate-200 bg-white rounded-xl px-3 py-2"
                      type="number"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(i, { unitPrice: num(e.target.value) })}
                      disabled={disabled}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <input
                      className="w-20 text-center text-xs border border-slate-200 bg-slate-50 rounded-xl px-2 py-2 font-bold"
                      type="number"
                      value={row.discountRate}
                      onChange={(e) => updateRow(i, { discountRate: num(e.target.value) })}
                      disabled={disabled}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <select
                      className={`text-xs border border-slate-200 rounded-xl px-2 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${saleType !== "official" ? "bg-slate-100 text-slate-400" : "bg-white"}`}
                      value={saleType === "official" ? num(row.vatRate) : 0}
                      onChange={(e) => updateRow(i, { vatRate: num(e.target.value) })}
                      disabled={disabled || saleType !== "official"}
                    >
                      {saleType !== "official" ? (
                        <option value={0}>%0</option>
                      ) : (
                        activeVatRates.map((v) => (
                          <option key={v.rate} value={v.rate}>
                            %{v.rate}
                          </option>
                        ))
                      )}
                    </select>
                  </td>

                  <td className="px-4 py-3 text-right font-extrabold text-sm text-slate-900">
                    {fmtMoney(row.total)} ₸
                    {saleType === "official" && (
                      <div className="text-[10px] text-slate-400 font-medium">
                        Net: {fmtMoney(row.net)} | KDV: {fmtMoney(row.vat)}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                      disabled={disabled}
                      title="Satır sil"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-slate-50">
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-2xl text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 hover:border-blue-400 transition-all disabled:opacity-60"
        >
          <PlusCircle size={18} /> Satır Ekle (Alt+N)
        </button>
      </div>
    </div>
  );
}
