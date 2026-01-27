//app/satissitok/admin/sales/new/components/SaleItemsTable.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

/**
 * props:
 * - items
 * - setItems
 * - products: [{ id, name, unit, price }]
 * - units
 * - vatRate
 * - vatMode ("include" | "exclude")
 * - saleType ("official" | "actual")
 */
export default function SaleItemsTable({
  items,
  setItems,
  products,
  units,
  vatRate,
  vatMode,
  saleType,
}) {
  // ---------- helpers ----------
  const round2 = (n) =>
    Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // ---------- hesap ----------
  function calcRow(row) {
    if (!row.productId || !row.quantity) {
      return { ...row, net: 0, vat: 0, total: 0 };
    }

    const qty = Number(row.quantity || 0);
    const baseUnitPrice = Number(row.unitPrice || 0);

    // indirim
    let effectiveUnitPrice = baseUnitPrice;

    if (row.discountType === "percent") {
      const rate = Number(row.discountValue || 0);
      effectiveUnitPrice = baseUnitPrice * (1 - rate / 100);
    }

    if (row.discountType === "manual") {
      effectiveUnitPrice = Number(row.discountValue || 0);
    }

    effectiveUnitPrice = round2(effectiveUnitPrice);

    let net = 0;
    let vat = 0;
    let total = 0;

    if (saleType === "official") {
      if (vatMode === "exclude") {
        net = round2(qty * effectiveUnitPrice);
        vat = round2(net * (vatRate / 100));
        total = round2(net + vat);
      } else {
        total = round2(qty * effectiveUnitPrice);
        net = round2(total / (1 + vatRate / 100));
        vat = round2(total - net);
      }
    } else {
      net = round2(qty * effectiveUnitPrice);
      vat = 0;
      total = net;
    }

    return { ...row, net, vat, total };
  }

  function updateRow(index, patch) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = calcRow({ ...copy[index], ...patch });
      return copy;
    });
  }

  function removeRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------- ÜRÜN SEÇİMİ (AUTOCOMPLETE) ----------
  function onProductPick(index, productName) {
    const product = products.find(
      (p) => p.name === productName
    );
    if (!product) return;

    updateRow(index, {
      productId: product.id,
      productName: product.name,
      unit: product.unit || "",
      unitPrice: Number(product.price || 0),
      discountType: "none",
      discountValue: 0,
    });
  }

  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Ürün</th>
            <th className="p-2">Miktar</th>
            <th className="p-2">Birim</th>
            <th className="p-2">Birim Fiyat</th>
            <th className="p-2">İndirim</th>
            <th className="p-2">Değer</th>
            <th className="p-2 text-right">KDV</th>
            <th className="p-2 text-right">Toplam</th>
            <th className="p-2"></th>
          </tr>
        </thead>

        <tbody>
          {items.map((row, index) => (
            <tr key={index} className="border-t">
              {/* ÜRÜN – AUTOCOMPLETE */}
              <td className="p-2">
                <input
                  list={`products-${index}`}
                  className="w-full border p-1"
                  placeholder="Ürün ara…"
                  value={row.productName || ""}
                  onChange={(e) =>
                    onProductPick(index, e.target.value)
                  }
                />
                <datalist id={`products-${index}`}>
                  {products.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </td>

              {/* MİKTAR */}
              <td className="p-2">
                <input
                  type="number"
                  className="w-full border p-1"
                  value={row.quantity || ""}
                  onChange={(e) =>
                    updateRow(index, {
                      quantity: e.target.value,
                    })
                  }
                />
              </td>

              {/* BİRİM */}
              <td className="p-2">
                <select
                  className="w-full border p-1"
                  value={row.unit || ""}
                  onChange={(e) =>
                    updateRow(index, { unit: e.target.value })
                  }
                >
                  <option value="">-</option>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </td>

              {/* BİRİM FİYAT */}
              <td className="p-2">
                <input
                  type="number"
                  className="w-full border p-1"
                  value={row.unitPrice || ""}
                  onChange={(e) =>
                    updateRow(index, {
                      unitPrice: e.target.value,
                    })
                  }
                />
              </td>

              {/* İNDİRİM TÜRÜ */}
              <td className="p-2">
                <select
                  className="w-full border p-1"
                  value={row.discountType || "none"}
                  onChange={(e) =>
                    updateRow(index, {
                      discountType: e.target.value,
                      discountValue: 0,
                    })
                  }
                >
                  <option value="none">Yok</option>
                  <option value="percent">%</option>
                  <option value="manual">Manuel</option>
                </select>
              </td>

              {/* İNDİRİM DEĞERİ */}
              <td className="p-2">
                {row.discountType !== "none" && (
                  <input
                    type="number"
                    className="w-full border p-1"
                    value={row.discountValue || ""}
                    onChange={(e) =>
                      updateRow(index, {
                        discountValue: e.target.value,
                      })
                    }
                  />
                )}
              </td>

              {/* KDV */}
              <td className="p-2 text-right">
                {row.vat ? row.vat.toFixed(2) : "0.00"}
              </td>

              {/* TOPLAM */}
              <td className="p-2 text-right">
                {row.total ? row.total.toFixed(2) : "0.00"}
              </td>

              {/* SİL */}
              <td className="p-2 text-center">
                <button
                  onClick={() => removeRow(index)}
                  className="text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
