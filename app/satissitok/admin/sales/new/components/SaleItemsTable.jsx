// app/satissitok/admin/sales/new/components/SaleItemsTable.jsx
"use client";

import { useEffect, useMemo } from "react";
import { Trash2 } from "lucide-react";

export default function SaleItemsTable({
  items,
  setItems,
  products,
  vatRate,
  vatMode,
  saleType,
}) {
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  function calcRow(row) {
    if (!row.productId || !row.quantity) {
      return { ...row, net: 0, vat: 0, total: 0 };
    }

    const qty = Number(row.quantity || 0);
    const unitPrice = Number(row.unitPrice || 0);
    const discountRate = Number(row.discountRate || 0);

    const priceAfterDiscount = unitPrice * (1 - discountRate / 100);
    let net = round2(qty * priceAfterDiscount);
    let vat = 0;
    let total = 0;

    if (saleType === "official") {
      if (vatMode === "exclude") {
        vat = round2(net * (vatRate / 100));
        total = round2(net + vat);
      } else {
        vat = round2(net - net / (1 + vatRate / 100));
        total = net;
        net = round2(total - vat);
      }
    } else {
      total = net;
    }

    return { ...row, net, vat, total };
  }

  function updateRow(idx, patch) {
    setItems((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, ...patch };
        return calcRow(updated);
      })
    );
  }

  function removeRow(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const stockMap = useMemo(() => {
    const map = {};
    for (const p of products || []) {
      const bucket =
        saleType === "official"
          ? p?.stock_balances?.official
          : p?.stock_balances?.actual;

      map[p.id] = Number(bucket?.qty ?? 0);
    }
    return map;
  }, [products, saleType]);

  return (
    <div className="overflow-x-auto border rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Ürün</th>
            <th className="p-2">Stok</th>
            <th className="p-2">Miktar</th>
            <th className="p-2">Birim Fiyat</th>
            <th className="p-2">İsk.%</th>
            <th className="p-2">Net</th>
            <th className="p-2">KDV</th>
            <th className="p-2">Toplam</th>
            <th className="p-2"></th>
          </tr>
        </thead>

        <tbody>
          {items.map((row, idx) => {
            const available = stockMap[row.productId] ?? 0;
            const qty = Number(row.quantity || 0);
            const insufficient = row.productId && qty > available;

            return (
              <tr
                key={idx}
                className={insufficient ? "bg-red-50" : ""}
              >
                <td className="p-2">
                  <select
                    className="border p-1 w-full"
                    value={row.productId}
                    onChange={(e) => {
                      const p = products.find((x) => x.id === e.target.value);
                      updateRow(idx, {
                        productId: p?.id || "",
                        productName: p?.name || "",
                        unit: p?.unit || "",
                        unitPrice: p?.price || "",
                      });
                    }}
                  >
                    <option value="">Seçiniz</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className={`p-2 ${insufficient ? "text-red-600 font-semibold" : ""}`}>
                  {available}
                </td>

                <td className="p-2">
                  <input
                    type="number"
                    className="border p-1 w-full"
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(idx, { quantity: e.target.value })
                    }
                  />
                  {insufficient && (
                    <div className="text-xs text-red-600 mt-1">
                      Stok yetersiz (mevcut {available})
                    </div>
                  )}
                </td>

                <td className="p-2">
                  <input
                    type="number"
                    className="border p-1 w-full"
                    value={row.unitPrice}
                    onChange={(e) =>
                      updateRow(idx, { unitPrice: e.target.value })
                    }
                  />
                </td>

                <td className="p-2">
                  <input
                    type="number"
                    className="border p-1 w-full"
                    value={row.discountRate || 0}
                    onChange={(e) =>
                      updateRow(idx, { discountRate: e.target.value })
                    }
                  />
                </td>

                <td className="p-2">{row.net?.toFixed(2)}</td>
                <td className="p-2">{row.vat?.toFixed(2)}</td>
                <td className="p-2">{row.total?.toFixed(2)}</td>

                <td className="p-2 text-center">
                  <button onClick={() => removeRow(idx)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}

          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="p-4 text-center text-gray-400">
                Ürün ekleyin
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
