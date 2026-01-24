//app/satissitok/admin/purchases/new/components/PurchaseItemsTable.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

export default function PurchaseItemsTable({ onChange }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);

  // Dropdown içi arama state’i (satır bazlı)
  const [searchMap, setSearchMap] = useState({});

  useEffect(() => {
    const loadProducts = async () => {
      const snap = await getDocs(collection(db, "products"));
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(list);
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
        qty: 1,
        unitCost: 0,
        lineTotal: 0,
        unit: "",
      },
    ]);
  };

  const removeRow = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const updateRow = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    const qty = Number(updated[index].qty) || 0;
    const unitCost = Number(updated[index].unitCost) || 0;
    updated[index].lineTotal = qty * unitCost;

    setItems(updated);
  };

  const handleProductSelect = (rowIndex, productId) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const updated = [...items];
    updated[rowIndex].productId = productId;
    updated[rowIndex].unit = product.unit || "";

    setItems(updated);
  };

  const getFilteredProducts = (rowIndex) => {
    const q = (searchMap[rowIndex] || "").toLowerCase().trim();
    if (!q) return products;

    return products.filter((p) =>
      (p.name || "").toLowerCase().includes(q)
    );
  };

  return (
    <div className="space-y-4">
      {/* Başlık */}
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

      {/* Tablo */}
      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 w-1/3">Ürün</th>
            <th className="border px-2 py-1 w-24">Miktar</th>
            <th className="border px-2 py-1 w-32">Birim</th>
            <th className="border px-2 py-1 w-32">Birim Maliyet</th>
            <th className="border px-2 py-1 w-32">Toplam</th>
            <th className="border px-2 py-1 w-16"></th>
          </tr>
        </thead>

        <tbody>
          {items.map((row, index) => (
            <tr key={index}>
              {/* ÜRÜN – YAZARAK FİLTRELİ SELECT */}
              <td className="border px-2 py-1 align-top">
                <input
                  type="text"
                  placeholder="Ürün yazın..."
                  className="w-full border rounded px-2 py-1 mb-1 text-xs"
                  value={searchMap[index] || ""}
                  onChange={(e) =>
                    setSearchMap({
                      ...searchMap,
                      [index]: e.target.value,
                    })
                  }
                />

                <select
                  className="w-full border rounded px-1 py-1"
                  value={row.productId}
                  onChange={(e) =>
                    handleProductSelect(index, e.target.value)
                  }
                >
                  <option value="">Seçiniz</option>
                  {getFilteredProducts(index).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>

              {/* MİKTAR */}
              <td className="border px-2 py-1">
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-1 py-1"
                  value={row.qty}
                  onChange={(e) =>
                    updateRow(index, "qty", e.target.value)
                  }
                />
              </td>

              {/* BİRİM */}
              <td className="border px-2 py-1 text-center text-gray-700">
                {row.unit || "-"}
              </td>

              {/* BİRİM MALİYET */}
              <td className="border px-2 py-1">
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-1 py-1"
                  value={row.unitCost}
                  onChange={(e) =>
                    updateRow(index, "unitCost", e.target.value)
                  }
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
                  onClick={() => removeRow(index)}
                  className="text-red-600"
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
