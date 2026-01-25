//app/satissitok/admin/purchases/new/components/PurchaseItemsTable.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

function round2(n) {
  const x = Number(n) || 0;
  return Math.round(x * 100) / 100;
}

function fmt(n) {
  const x = Number(n) || 0;
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PurchaseItemsTable({
  onChange,
  vatRate = 0,
  vatMode = "inclusive",
  hideVat = false,
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

  const effectiveVatRate = hideVat ? 0 : Number(vatRate || 0);

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
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

  const calcRow = (row) => {
    const qty = Number(row.qty) || 0;
    const unitPrice = Number(row.unitPrice) || 0;
    const r = Number(effectiveVatRate) || 0;
    const factor = 1 + r / 100;

    let netUnit = 0;
    let vatUnit = 0;
    let grossUnit = 0;

    if (r === 0) {
      netUnit = unitPrice;
      vatUnit = 0;
      grossUnit = unitPrice;
    } else if (vatMode === "exclusive") {
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
    x[i].unit = p.unit || "";
    x[i].search = p.name || "";
    calcRow(x[i]);
    setItems(x);
    setOpenIndex(null);
  };

  const filtered = useMemo(() => {
    return (q) =>
      !q
        ? products
        : products.filter((p) =>
            (p.name || "").toLowerCase().includes(q.toLowerCase())
          );
  }, [products]);

  const isVatVisible = !hideVat;

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

      {/* ✅ TABLOYU SARAN ALAN VAR, AMA OVERFLOW YOK */}
      <div className="w-full">
        <table className="w-full border text-sm table-fixed border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border w-[28%]">Ürün</th>
              <th className="border w-[7%]">Miktar</th>
              <th className="border w-[7%]">Birim</th>
              <th className="border w-[10%]">Birim Fiyat</th>

              {isVatVisible && (
                <>
                  <th className="border w-[10%]">KDV’siz Birim</th>
                  <th className="border w-[10%]">KDV Birim</th>
                  <th className="border w-[10%]">Toplam Birim</th>
                  <th className="border w-[10%]">KDV’siz Toplam</th>
                  <th className="border w-[10%]">KDV Toplam</th>
                </>
              )}

              <th className="border w-[12%]">Toplam</th>
              <th className="border w-[4%]"></th>
            </tr>
          </thead>

          <tbody>
            {items.map((r, i) => (
              <tr key={i}>
                <td className="border relative">
                  <input
                    type="text"
                    className="w-full h-9 px-2 text-sm border"
                    value={r.search}
                    placeholder="Ürün yazın..."
                    onFocus={() => setOpenIndex(i)}
                    onBlur={() => setTimeout(() => setOpenIndex(null), 150)}
                    onChange={(e) => updateRow(i, "search", e.target.value)}
                  />

                  {openIndex === i && (
                    <div className="absolute left-0 top-full mt-1 bg-white border w-full z-50 max-h-64 overflow-y-auto shadow">
                      {filtered(r.search).map((p) => (
                        <div
                          key={p.id}
                          className="px-3 py-2 hover:bg-blue-100 cursor-pointer"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectProduct(i, p);
                          }}
                        >
                          {p.name}
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                <td className="border">
                  <input
                    type="number"
                    className="w-full h-9 px-2 text-sm border-0"
                    value={r.qty}
                    min={0}
                    onChange={(e) => updateRow(i, "qty", e.target.value)}
                  />
                </td>

                <td className="border text-center">{r.unit || "-"}</td>

                <td className="border">
                  <input
                    type="number"
                    className="w-full h-9 px-2 text-sm border-0"
                    value={r.unitPrice}
                    min={0}
                    onChange={(e) => updateRow(i, "unitPrice", e.target.value)}
                  />
                </td>

                {isVatVisible && (
                  <>
                    <td className="border text-right px-2">{fmt(r.netUnitPrice)} ₸</td>
                    <td className="border text-right px-2">{fmt(r.vatUnitPrice)} ₸</td>
                    <td className="border text-right px-2">{fmt(r.grossUnitPrice)} ₸</td>
                    <td className="border text-right px-2">{fmt(r.netLineTotal)} ₸</td>
                    <td className="border text-right px-2">{fmt(r.vatLineTotal)} ₸</td>
                  </>
                )}

                <td className="border text-right px-2 font-semibold">
                  {fmt(r.grossLineTotal)} ₸
                </td>

                <td className="border text-center">
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() => {
                      const x = [...items];
                      x.splice(i, 1);
                      setItems(x);
                    }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={isVatVisible ? 11 : 6} className="border text-center py-6 text-gray-500">
                  Henüz ürün eklenmedi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-600">
        Kullanıcı sadece <strong>Miktar</strong> ve <strong>Birim Fiyat</strong> girer.
        Diğer alanlar sistem tarafından hesaplanır.
      </div>
    </div>
  );
}
