// app/satissitok/admin/sales/new/components/SaleItemsTable.jsx
"use client";

import { Trash2 } from "lucide-react";

export default function SaleItemsTable({ items, setItems, products, vatRate, vatMode, saleType }) {
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  function calcRow(row) {
    if (!row.productId || !row.quantity) return { ...row, net: 0, vat: 0, total: 0 };

    const qty = Number(row.quantity || 0);
    const unitPrice = Number(row.unitPrice || 0);
    const discountRate = Number(row.discountRate || 0);

    const priceAfterDiscount = round2(unitPrice * (1 - discountRate / 100));

    let net = 0,
      vat = 0,
      total = 0;

    if (saleType === "official") {
      if (vatMode === "exclude") {
        net = round2(qty * priceAfterDiscount);
        vat = round2(net * (vatRate / 100));
        total = round2(net + vat);
      } else {
        total = round2(qty * priceAfterDiscount);
        net = round2(total / (1 + vatRate / 100));
        vat = round2(total - net);
      }
    } else {
      net = round2(qty * priceAfterDiscount);
      vat = 0;
      total = net;
    }

    return { ...row, net, vat, total };
  }

  function updateRow(i, patch, { recalc = true } = {}) {
    setItems((prev) => {
      const copy = [...prev];
      const merged = { ...copy[i], ...patch };
      copy[i] = recalc ? calcRow(merged) : merged;
      return copy;
    });
  }

  function selectProduct(i, product) {
  if (!product) return;

  updateRow(i, {
    productId: product.id,
    productName: product.name || "",
    unit: product.unit || "",   // ✅ FIRESTORE'DAN GELEN BİRİM
    unitPrice: Number(product.price || 0),
    discountRate: 0,
  });
}


  function onProductInputChange(i, value) {
    // typing serbest: sadece isim yazarken productId kilitlenmesin
    const exact = products.find((p) => (p.name || "").toLowerCase() === (value || "").toLowerCase());

    if (exact) {
      selectProduct(i, exact);
      return;
    }

    updateRow(
  i,
  {
    productName: value,
    productId: "",
    unit: "",
    unitPrice: "",
    discountRate: 0,
    net: 0,
    vat: 0,
    total: 0,
  },
  { recalc: false }
);

  }

  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Ürün</th>
            <th className="p-2">Miktar</th>
            <th className="p-2">Birim</th>
            <th className="p-2">Birim Satış Fiyatı</th>
            <th className="p-2">% İndirim</th>
            <th className="p-2 text-right">KDV</th>
            <th className="p-2 text-right">Toplam</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {items.map((row, i) => (
            <tr key={i} className="border-t align-top">
              <td className="p-2">
                <input
                  list={`products-${i}`}
                  className="w-full border p-2"
                  value={row.productName || ""}
                  placeholder="Ürün ara…"
                  onChange={(e) => onProductInputChange(i, e.target.value)}
                  onBlur={(e) => {
                    const exact = products.find(
                      (p) => (p.name || "").toLowerCase() === (e.target.value || "").toLowerCase()
                    );
                    if (exact) selectProduct(i, exact);
                  }}
                />
                <datalist id={`products-${i}`}>
                  {products.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>

                {!row.productId && row.productName ? (
                  <div className="text-xs text-red-600 mt-1">Ürün seçilmedi (listeden seç)</div>
                ) : null}
              </td>

              <td className="p-2">
                <input
                  type="number"
                  className="w-full border p-2"
                  value={row.quantity || ""}
                  onChange={(e) => updateRow(i, { quantity: e.target.value })}
                />
              </td>

              <td className="p-2">
                <input className="w-full border p-2 bg-gray-100" value={row.unit || ""} readOnly />
              </td>

              <td className="p-2">
                <input
                  type="number"
                  className="w-full border p-2"
                  value={row.unitPrice || ""}
                  onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                />
              </td>

              <td className="p-2">
                <input
                  type="number"
                  className="w-full border p-2"
                  value={row.discountRate ?? 0}
                  onChange={(e) => updateRow(i, { discountRate: e.target.value })}
                />
              </td>

              <td className="p-2 text-right">{Number(row.vat || 0).toFixed(2)}</td>
              <td className="p-2 text-right">{Number(row.total || 0).toFixed(2)}</td>

              <td className="p-2 text-center">
                <button
                  className="p-1"
                  onClick={() => setItems((prev) => prev.filter((_, x) => x !== i))}
                  title="Sil"
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
