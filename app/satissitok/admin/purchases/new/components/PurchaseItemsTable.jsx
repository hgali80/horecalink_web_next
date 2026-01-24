//app/satissitok/admin/purchases/new/components/PurchaseItemsTable.jsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { getSettings } from "@/app/satissitok/services/settingsService";

export default function PurchaseItemsTable({ onChange }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);
  const [vatRate, setVatRate] = useState(0);

  useEffect(() => {
    const load = async () => {
      const pSnap = await getDocs(collection(db, "products"));
      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const settings = await getSettings();
      const defVat = settings?.taxes?.vat?.find(v => v.default);
      setVatRate(defVat ? defVat.rate : 0);
    };
    load();
  }, []);

  useEffect(() => {
    onChange(items);
  }, [items, onChange]);

  const addRow = () => {
    setItems([...items, {
      productId: "",
      productName: "",
      unit: "",
      qty: 1,
      unitCost: 0,
      vatType: "exclusive", // exclusive | inclusive
      vatAmount: 0,
      lineTotal: 0,
      search: "",
    }]);
  };

  const calcRow = (row) => {
    const qty = Number(row.qty) || 0;
    const cost = Number(row.unitCost) || 0;
    const net = qty * cost;

    let vat = 0;
    let total = net;

    if (row.vatType === "exclusive") {
      vat = net * vatRate / 100;
      total = net + vat;
    } else {
      vat = net - (net / (1 + vatRate / 100));
      total = net;
    }

    row.vatAmount = Math.round(vat);
    row.lineTotal = Math.round(total);
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
    x[i].productName = p.name;
    x[i].unit = p.unit || "";
    x[i].search = p.name;
    calcRow(x[i]);
    setItems(x);
    setOpenIndex(null);
  };

  const filtered = (q) =>
    !q ? products : products.filter(p =>
      (p.name || "").toLowerCase().includes(q.toLowerCase())
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-lg font-semibold">Satınalma Kalemleri</h3>
        <button onClick={addRow} className="px-3 py-1 bg-blue-600 text-white rounded">
          + Ürün Ekle
        </button>
      </div>

      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border w-[35%]">Ürün</th>
            <th className="border w-[8%]">Miktar</th>
            <th className="border w-[8%]">Birim</th>
            <th className="border w-[12%]">Birim Maliyet</th>
            <th className="border w-[10%]">KDV Tipi</th>
            <th className="border w-[12%]">KDV Tutarı</th>
            <th className="border w-[15%]">Toplam</th>
            <th className="border w-[5%]"></th>
          </tr>
        </thead>

        <tbody>
          {items.map((r, i) => (
            <tr key={i}>
              <td className="border relative">
                <input
                  className="w-full border px-2 py-1"
                  value={r.search}
                  placeholder="Ürün yazın..."
                  onFocus={() => setOpenIndex(i)}
                  onChange={e => updateRow(i, "search", e.target.value)}
                />
                {openIndex === i && (
                  <div className="absolute bg-white border w-full z-10 max-h-48 overflow-y-auto">
                    {filtered(r.search).map(p => (
                      <div
                        key={p.id}
                        className="px-2 py-1 hover:bg-blue-100 cursor-pointer"
                        onMouseDown={() => selectProduct(i, p)}
                      >
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
              </td>

              <td className="border">
                <input type="number" className="w-full px-1"
                  value={r.qty}
                  onChange={e => updateRow(i, "qty", e.target.value)} />
              </td>

              <td className="border text-center">{r.unit}</td>

              <td className="border">
                <input type="number" className="w-full px-1"
                  value={r.unitCost}
                  onChange={e => updateRow(i, "unitCost", e.target.value)} />
              </td>

              <td className="border">
                <select
                  className="w-full"
                  value={r.vatType}
                  onChange={e => updateRow(i, "vatType", e.target.value)}
                >
                  <option value="exclusive">Hariç</option>
                  <option value="inclusive">Dahil</option>
                </select>
              </td>

              <td className="border text-right">
                {r.vatAmount.toLocaleString()} ₸
              </td>

              <td className="border text-right font-semibold">
                {r.lineTotal.toLocaleString()} ₸
              </td>

              <td className="border text-center">
                <button className="text-red-600" onClick={() => {
                  const x = [...items];
                  x.splice(i, 1);
                  setItems(x);
                }}>
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
