//app/satissitok/admin/sales/new/components/SaleItemsTable.jsx
"use client";

import { Trash2 } from "lucide-react";

export default function SaleItemsTable({
  items,
  setItems,
  products,
  units,
  vatRate,
  vatMode,
  saleType,
}) {
  const round2 = (n) =>
    Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  function calcRow(row) {
    if (!row.productId || !row.quantity) {
      return { ...row, net: 0, vat: 0, total: 0 };
    }

    const qty = Number(row.quantity || 0);
    const base = Number(row.unitPrice || 0);

    let price = base;

    if (row.discountType === "percent") {
      price = base * (1 - Number(row.discountValue || 0) / 100);
    }
    if (row.discountType === "manual") {
      price = Number(row.discountValue || 0);
    }

    price = round2(price);

    let net = 0,
      vat = 0,
      total = 0;

    if (saleType === "official") {
      if (vatMode === "exclude") {
        net = round2(qty * price);
        vat = round2(net * (vatRate / 100));
        total = net + vat;
      } else {
        total = round2(qty * price);
        net = round2(total / (1 + vatRate / 100));
        vat = round2(total - net);
      }
    } else {
      net = round2(qty * price);
      vat = 0;
      total = net;
    }

    return { ...row, net, vat, total };
  }

  function updateRow(i, patch) {
    setItems((prev) => {
      const copy = [...prev];
      copy[i] = calcRow({ ...copy[i], ...patch });
      return copy;
    });
  }

  function onProductSelect(i, name) {
    const p = products.find((x) => x.name === name);
    if (!p) return;

    updateRow(i, {
      productId: p.id,
      productName: p.name,
      unit: p.unit || "",
      unitPrice: Number(p.price || 0),
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
            <th className="p-2 text-right">KDV</th>
            <th className="p-2 text-right">Toplam</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {items.map((row, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">
                <input
                  list={`products-${i}`}
                  className="w-full border p-1"
                  value={row.productName || ""}
                  placeholder="Ürün ara…"
                  onChange={(e) =>
                    updateRow(i, { productName: e.target.value })
                  }
                  onBlur={(e) =>
                    onProductSelect(i, e.target.value)
                  }
                />
                <datalist id={`products-${i}`}>
                  {products.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </td>

              <td className="p-2">
                <input
                  type="number"
                  className="w-full border p-1"
                  value={row.quantity || ""}
                  onChange={(e) =>
                    updateRow(i, { quantity: e.target.value })
                  }
                />
              </td>

              <td className="p-2">
                <select
                  className="w-full border p-1"
                  value={row.unit || ""}
                  onChange={(e) =>
                    updateRow(i, { unit: e.target.value })
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

              <td className="p-2">
                <input
                  type="number"
                  className="w-full border p-1"
                  value={row.unitPrice || ""}
                  onChange={(e) =>
                    updateRow(i, { unitPrice: e.target.value })
                  }
                />
              </td>

              <td className="p-2">
                <select
                  className="w-full border p-1"
                  value={row.discountType || "none"}
                  onChange={(e) =>
                    updateRow(i, {
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

              <td className="p-2 text-right">
                {row.vat?.toFixed(2) || "0.00"}
              </td>

              <td className="p-2 text-right">
                {row.total?.toFixed(2) || "0.00"}
              </td>

              <td className="p-2 text-center">
                <button
                  onClick={() =>
                    setItems((prev) =>
                      prev.filter((_, x) => x !== i)
                    )
                  }
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
