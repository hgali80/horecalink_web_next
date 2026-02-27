// app/satissitok/admin/purchases/new/components/PurchaseItemsTable.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { Boxes, Plus, Search, Trash2 } from "lucide-react";

function round2(n) {
  const x = Number(n) || 0;
  return Math.round(x * 100) / 100;
}

function fmt(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

export default function PurchaseItemsTable({
  onChange,
  vatRate = 0,
  vatMode = "inclusive",
  hideVat = false, // fiili fatura = true
}) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  useEffect(() => {
    onChange(items);
  }, [items, onChange]);

  const calcRow = (row) => {
    const qty = Number(row.qty) || 0;
    const unitPrice = Number(row.unitPrice) || 0;

    // ✅ FİİLİ FATURA → KDV YOK
    if (hideVat === true) {
      row.netUnitPrice = round2(unitPrice);
      row.vatUnitPrice = 0;
      row.grossUnitPrice = round2(unitPrice);

      row.netLineTotal = round2(qty * unitPrice);
      row.vatLineTotal = 0;
      row.grossLineTotal = round2(qty * unitPrice);
      return;
    }

    // ✅ RESMİ FATURA → KDV VAR
    const r = Number(vatRate || 0);
    const factor = 1 + r / 100;

    let netUnit = 0;
    let vatUnit = 0;
    let grossUnit = 0;

    if (vatMode === "exclusive") {
      netUnit = unitPrice;
      vatUnit = unitPrice * (r / 100);
      grossUnit = netUnit + vatUnit;
    } else {
      grossUnit = unitPrice;
      netUnit = grossUnit / factor;
      vatUnit = grossUnit - netUnit;
    }

    row.netUnitPrice = round2(netUnit);
    row.vatUnitPrice = round2(vatUnit);
    row.grossUnitPrice = round2(grossUnit);

    row.netLineTotal = round2(qty * row.netUnitPrice);
    row.vatLineTotal = round2(qty * row.vatUnitPrice);
    row.grossLineTotal = round2(qty * row.grossUnitPrice);
  };

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
        sku: "",
        unit: "",
        qty: 1,
        unitPrice: 0,

        netUnitPrice: 0,
        vatUnitPrice: 0,
        grossUnitPrice: 0,

        netLineTotal: 0,
        vatLineTotal: 0,
        grossLineTotal: 0,

        search: "",
      },
    ]);
  };

  const removeRow = (i) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateRow = (i, field, value) => {
    const x = [...items];
    x[i][field] = value;
    calcRow(x[i]);
    setItems(x);
  };

  const selectProduct = (i, p) => {
    const x = [...items];
    x[i].productId = p.id;
    x[i].productName = p.name || "";
    x[i].sku = p.sku || p.stockCode || p.code || "";
    x[i].unit = p.unit || "";
    x[i].search = p.name || "";
    calcRow(x[i]);
    setItems(x);
    setOpenIndex(null);
  };

  const filteredProductsByRow = (row) => {
    const q = (row.search || "").trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products
      .filter((p) => {
        const name = (p.name || "").toLowerCase();
        const sku = (p.sku || p.stockCode || p.code || "").toLowerCase();
        return name.includes(q) || sku.includes(q);
      })
      .slice(0, 50);
  };

  const vatLabel = hideVat ? "0%" : `${Number(vatRate || 0)}%`;

  const totalQty = useMemo(
    () => items.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [items]
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2 text-[#135bec]">
          <Boxes size={20} />
          <h2 className="text-lg font-bold text-slate-900">Satır Öğeleri</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] text-slate-500 font-bold">
            Satır: {items.length} • Toplam Adet: {fmt(totalQty)}
          </div>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-[#135bec] rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
          >
            <Plus size={16} />
            Satır Ekle
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4 w-12 text-center">#</th>
              <th className="px-4 py-4 min-w-[320px]">Ürün / SKU</th>
              <th className="px-4 py-4 w-24">Miktar</th>
              <th className="px-4 py-4 w-24">Birim</th>
              <th className="px-4 py-4 w-44 text-right">Birim Maliyet (₸)</th>
              <th className="px-4 py-4 w-24 text-right">KDV %</th>
              <th className="px-4 py-4 w-44 text-right">Toplam (₸)</th>
              <th className="px-6 py-4 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((row, i) => (
              <tr
                key={i}
                className="group hover:bg-slate-50/50 transition-colors align-top"
              >
                <td className="px-6 py-4 text-xs text-slate-400 font-mono text-center">
                  {String(i + 1).padStart(2, "0")}
                </td>

                {/* ÜRÜN */}
                <td className="px-4 py-4 relative">
                  <div className="flex flex-col">
                    <input
                      className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0 text-slate-900 w-full"
                      type="text"
                      placeholder="Ürün arayın..."
                      value={row.search}
                      onFocus={() => setOpenIndex(i)}
                      onBlur={() => setTimeout(() => setOpenIndex(null), 150)}
                      onChange={(e) => updateRow(i, "search", e.target.value)}
                    />
                    <span className="text-[10px] text-slate-400 font-mono">
                      SKU: {row.sku || "-"}
                    </span>
                  </div>

                  {openIndex === i && (
                    <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 w-[420px] z-50 max-h-72 overflow-y-auto rounded-lg shadow-lg">
                      {filteredProductsByRow(row).map((p) => {
                        const sku = p.sku || p.stockCode || p.code || "";
                        return (
                          <div
                            key={p.id}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectProduct(i, p);
                            }}
                          >
                            <div className="text-sm font-bold text-slate-800">
                              {p.name || "-"}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {sku ? `SKU: ${sku}` : "SKU: -"}
                              {p.unit ? ` • Birim: ${p.unit}` : ""}
                            </div>
                          </div>
                        );
                      })}
                      {!filteredProductsByRow(row).length && (
                        <div className="px-3 py-3 text-[11px] text-slate-500">
                          Ürün bulunamadı.
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {/* QTY */}
                <td className="px-4 py-4">
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-2 text-sm text-center focus:border-[#135bec] focus:ring-0"
                    type="number"
                    min={0}
                    value={row.qty}
                    onChange={(e) => updateRow(i, "qty", e.target.value)}
                  />
                </td>

                {/* UNIT */}
                <td className="px-4 py-4">
                  <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2 py-1 rounded">
                    {row.unit || "-"}
                  </span>
                </td>

                {/* UNIT PRICE */}
                <td className="px-4 py-4">
                  <div className="flex flex-col items-end gap-1">
                    <input
                      className="w-full bg-transparent border-none p-0 text-sm font-mono font-bold text-right focus:ring-0"
                      type="number"
                      min={0}
                      value={row.unitPrice}
                      onChange={(e) => updateRow(i, "unitPrice", e.target.value)}
                      placeholder="0"
                    />
                    <div className="text-[10px] text-slate-400 font-mono">
                      Net: {fmt(row.netUnitPrice)} • KDV: {fmt(row.vatUnitPrice)}
                    </div>
                  </div>
                </td>

                {/* VAT */}
                <td className="px-4 py-4 text-right">
                  <span className="text-xs font-bold text-slate-500">{vatLabel}</span>
                </td>

                {/* TOTAL */}
                <td className="px-4 py-4 text-right font-mono font-bold text-sm text-slate-900">
                  {fmt(row.grossLineTotal)}
                </td>

                {/* DELETE */}
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Satırı sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}

            {/* QUICK ADD ROW */}
            <tr className="bg-slate-50/30">
              <td className="px-4 py-3" colSpan={8}>
                <div className="flex items-center gap-4 w-full">
                  <div className="flex-grow relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Search size={16} />
                    </span>
                    <input
                      className="w-full bg-white border-dashed border-slate-300 border rounded-lg py-2 pl-9 pr-4 text-xs font-medium focus:ring-[#135bec] focus:border-[#135bec]"
                      placeholder="Eklemek için ürün arayın... (Satır Ekle ile başlat)"
                      type="text"
                      onFocus={() => {
                        if (items.length === 0) addRow();
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">
                    veya{" "}
                    <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] shadow-sm font-mono font-bold">
                      INS
                    </kbd>{" "}
                    tuşu
                  </span>
                </div>
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  );
}