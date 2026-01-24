//app/satissitok/admin/purchases/new/components/PurchaseItemsTable.jsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

export default function PurchaseItemsTable({ onChange }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    const loadProducts = async () => {
      const snap = await getDocs(collection(db, "products"));
      setProducts(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    };
    loadProducts();
  }, []);

  useEffect(() => {
    onChange(items);
  }, [items, onChange]);

  const addRow = () => {
    setItems([
      ...items,
      {
        productId: "",
        productName: "",
        unit: "",
        qty: 1,
        unitCost: 0,
        lineTotal: 0,
        search: "",
      },
    ]);
  };

  const removeRow = (i) => {
    const x = [...items];
    x.splice(i, 1);
    setItems(x);
  };

  const updateTotals = (x, i) => {
    const qty = Number(x[i].qty) || 0;
    const cost = Number(x[i].unitCost) || 0;
    x[i].lineTotal = qty * cost;
  };

  const selectProduct = (rowIndex, product) => {
    const x = [...items];
    x[rowIndex].productId = product.id;
    x[rowIndex].productName = product.name;
    x[rowIndex].unit = product.unit || "";
    x[rowIndex].search = product.name;
    updateTotals(x, rowIndex);
    setItems(x);
    setOpenIndex(null);
  };

  const filteredProducts = (search) => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter((p) =>
      (p.name || "").toLowerCase().includes(q)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Satınalma Kalemleri</h3>
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          + Ürün Ekle
        </button>
      </div>

      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 w-1/3">Ürün</th>
            <th className="border px-2 py-1">Miktar</th>
            <th className="border px-2 py-1">Birim</th>
            <th className="border px-2 py-1">Birim Maliyet</th>
            <th className="border px-2 py-1">Toplam</th>
            <th className="border px-2 py-1"></th>
          </tr>
        </thead>

        <tbody>
          {items.map((row, i) => (
            <tr key={i}>
              {/* ÜRÜN – AUTOCOMPLETE */}
              <td className="border px-2 py-1 relative">
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1"
                  placeholder="Ürün yazın..."
                  value={row.search}
                  onFocus={() => setOpenIndex(i)}
                  onChange={(e) => {
                    const x = [...items];
                    x[i].search = e.target.value;
                    setItems(x);
                    setOpenIndex(i);
                  }}
                />

                {openIndex === i && (
                  <div className="absolute z-10 bg-white border w-full max-h-48 overflow-y-auto">
                    {filteredProducts(row.search).map((p) => (
                      <div
                        key={p.id}
                        className="px-2 py-1 hover:bg-blue-100 cursor-pointer"
                        onMouseDown={() =>
                          selectProduct(i, p)
                        }
                      >
                        {p.name}
                      </div>
                    ))}

                    {filteredProducts(row.search).length === 0 && (
                      <div className="px-2 py-1 text-gray-400">
                        Sonuç yok
                      </div>
                    )}
                  </div>
                )}
              </td>

              {/* MİKTAR */}
              <td className="border px-2 py-1">
                <input
                  type="number"
                  className="w-full border rounded px-1 py-1"
                  value={row.qty}
                  onChange={(e) => {
                    const x = [...items];
                    x[i].qty = e.target.value;
                    updateTotals(x, i);
                    setItems(x);
                  }}
                />
              </td>

              {/* BİRİM */}
              <td className="border px-2 py-1 text-center">
                {row.unit || "-"}
              </td>

              {/* BİRİM MALİYET */}
              <td className="border px-2 py-1">
                <input
                  type="number"
                  className="w-full border rounded px-1 py-1"
                  value={row.unitCost}
                  onChange={(e) => {
                    const x = [...items];
                    x[i].unitCost = e.target.value;
                    updateTotals(x, i);
                    setItems(x);
                  }}
                />
              </td>

              {/* TOPLAM */}
              <td className="border px-2 py-1 text-right">
                {row.lineTotal.toLocaleString()} ₸
              </td>

              {/* SİL */}
              <td className="border px-2 py-1 text-center">
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() => removeRow(i)}
                >
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="text-sm text-gray-500">
          Henüz ürün eklenmedi.
        </div>
      )}
    </div>
  );
}
