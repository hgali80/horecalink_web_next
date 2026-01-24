//app/satissitok/admin/purchases/new/components/PurchaseItemsTable.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

export default function PurchaseItemsTable({ onChange }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  // Ürünleri çek
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

  // Parent’a bildir
  useEffect(() => {
    onChange(items);
  }, [items, onChange]);

  // Arama filtreleme (kiril + latin, parçalı)
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;

    return products.filter((p) =>
      (p.name || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const addRow = () => {
    setItems([
      ...items,
      {
        productId: "",
        qty: 1,
        unitCost: 0,
        lineTotal: 0,
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

  const getUnitByProductId = (productId) => {
    const product = products.find((p) => p.id === productId);
    return product?.unit || "";
  };

  return (
    <div className="space-y-4">
      {/* Başlık + Ekle */}
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

      {/* Ürün Arama */}
      <div>
        <input
          type="text"
          placeholder="Ürün ara (örn: Туалетна, Jumbo)"
          className="w-full border rounded px-2 py-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tablo */}
      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Ürün</th>
            <th className="border px-2 py-1">Miktar</th>
            <th className="border px-2 py-1">Birim Maliyet</th>
            <th className="border px-2 py-1">Toplam</th>
            <th className="border px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={index}>
              {/* Ürün */}
              <td className="border px-2 py-1">
                <select
                  className="w-full border rounded px-1 py-1"
                  value={row.productId}
                  onChange={(e) =>
                    updateRow(index, "productId", e.target.value)
                  }
                >
                  <option value="">Seçiniz</option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>

              {/* Miktar + Birim */}
              <td className="border px-2 py-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    className="w-20 border rounded px-1 py-1"
                    value={row.qty}
                    onChange={(e) =>
                      updateRow(index, "qty", e.target.value)
                    }
                  />
                  <span className="text-gray-500 text-xs">
                    {getUnitByProductId(row.productId)}
                  </span>
                </div>
              </td>

              {/* Birim Maliyet */}
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

              {/* Satır Toplam */}
              <td className="border px-2 py-1 text-right">
                {row.lineTotal.toLocaleString()} ₸
              </td>

              {/* Sil */}
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
