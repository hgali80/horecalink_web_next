// app/satissitok/admin/sales/new/components/SaleItemsTable.jsx
"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

/* ===============================
   HESAP YARDIMCILARI
================================ */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function calcSaleRow({
  quantity,
  unitPrice,        // KDV DAHİL (resmi satış)
  discountRate,
  vatRate,
  saleType,
}) {
  const qty = Number(quantity || 0);
  const price = Number(unitPrice || 0);
  const disc = Number(discountRate || 0);
  const vatR = Number(vatRate || 0);

  // Brüt (iskontolu)
  const discounted = round2(price * (1 - disc / 100) * qty);

  if (saleType === "official") {
    const net = round2(discounted / (1 + vatR / 100));
    const vat = round2(discounted - net);
    return { net, vat, total: discounted };
  }

  // Fiili satış
  return { net: discounted, vat: 0, total: discounted };
}

export default function SaleItemsTable({
  items,
  setItems,
  products,
  vatRate,
  saleType,
}) {
  const [openIndex, setOpenIndex] = useState(null);

  /* ===============================
     STOK HARİTASI
  ================================ */
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

  function updateRow(idx, patch) {
    setItems((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;

        const updated = { ...r, ...patch };

        if (!updated.productId || !updated.quantity) {
          return { ...updated, net: 0, vat: 0, total: 0 };
        }

        const { net, vat, total } = calcSaleRow({
          quantity: updated.quantity,
          unitPrice: updated.unitPrice,
          discountRate: updated.discountRate,
          vatRate,
          saleType,
        });

        return { ...updated, net, vat, total };
      })
    );
  }

  function removeRow(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ===============================
     FİLTRELENMİŞ ÜRÜNLER
     (SATINALMA İLE AYNI MANTIK)
  ================================ */
  const filteredProducts = useMemo(() => {
    return (q) =>
      !q
        ? products
        : products.filter((p) =>
            (p.name || "").toLowerCase().includes(q.toLowerCase())
          );
  }, [products]);

  return (
    <div className="overflow-x-auto border rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Ürün</th>
            <th className="p-2">Stok</th>
            <th className="p-2">Miktar</th>
            <th className="p-2">Birim Fiyat (KDV dahil)</th>
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

            const list = filteredProducts(row.search || "").slice(0, 20);

            return (
              <tr
                key={idx}
                className={insufficient ? "bg-red-50" : ""}
              >
                {/* ÜRÜN ARAMA (SATINALMA İLE AYNI) */}
                <td className="p-2 relative">
                  <input
                    type="text"
                    className="border p-1 w-full"
                    placeholder="Ürün yaz..."
                    value={row.search || ""}
                    onFocus={() => setOpenIndex(idx)}
                    onBlur={() =>
                      setTimeout(() => setOpenIndex(null), 150)
                    }
                    onChange={(e) =>
                      updateRow(idx, {
                        search: e.target.value,
                        productId: "",
                        productName: "",
                      })
                    }
                  />

                  {openIndex === idx && (
                    <div className="absolute z-30 bg-white border w-full max-h-56 overflow-y-auto">
                      {list.map((p) => (
                        <div
                          key={p.id}
                          className="p-2 hover:bg-gray-100 cursor-pointer"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            updateRow(idx, {
                              productId: p.id,
                              productName: p.name,
                              unit: p.unit,
                              unitPrice: p.price, // KDV DAHİL
                              search: p.name,
                            });
                          }}
                        >
                          {p.name}
                        </div>
                      ))}

                      {list.length === 0 && (
                        <div className="p-2 text-gray-400">
                          Ürün bulunamadı
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {/* STOK */}
                <td
                  className={`p-2 ${
                    insufficient ? "text-red-600 font-semibold" : ""
                  }`}
                >
                  {available}
                </td>

                {/* MİKTAR */}
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

                {/* FİYAT */}
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

                {/* İSKONTO */}
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
