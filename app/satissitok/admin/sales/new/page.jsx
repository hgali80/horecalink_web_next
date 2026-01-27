//app/satissitok/admin/sales/new/page.jsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase";

import { createSale } from "@/app/satissitok/services/saleService";

export default function NewSalePage() {
  const router = useRouter();

  const [saleType, setSaleType] = useState("actual"); // actual | official
  const [caris, setCaris] = useState([]);
  const [products, setProducts] = useState([]);
  const [cariId, setCariId] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    const carisSnap = await getDocs(collection(db, "caris"));
    setCaris(
      carisSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    );

    const prodSnap = await getDocs(collection(db, "products"));
    setProducts(
      prodSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }

  function addItem(product) {
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name || product.title || "",
        quantity: 1,
        unitPrice: product.price || 0, // 🔴 otomatik fiyat
        vatRate: 12,
      },
    ]);
  }

  function updateItem(idx, field, value) {
    const copy = [...items];
    copy[idx][field] = value;
    setItems(copy);
  }

  function removeItem(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function saveSale() {
    if (!cariId) {
      alert("Cari seçmelisin");
      return;
    }
    if (items.length === 0) {
      alert("Ürün eklemelisin");
      return;
    }

    setSaving(true);
    try {
      const res = await createSale({
        saleType,
        cariId,
        items,
      });

      router.push(`/satissitok/admin/sales/${res.saleId}`);
    } catch (err) {
      alert(err.message || "Hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Yeni Satış</h1>

      {/* Satış Tipi */}
      <div className="flex gap-4">
        <label>
          <input
            type="radio"
            checked={saleType === "actual"}
            onChange={() => setSaleType("actual")}
          />{" "}
          Fiili
        </label>
        <label>
          <input
            type="radio"
            checked={saleType === "official"}
            onChange={() => setSaleType("official")}
          />{" "}
          Resmi
        </label>
      </div>

      {/* Cari */}
      <div>
        <select
          value={cariId}
          onChange={(e) => setCariId(e.target.value)}
          className="border p-2 w-full"
        >
          <option value="">Cari seç</option>
          {caris.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firm}
            </option>
          ))}
        </select>
      </div>

      {/* Ürün Ekle */}
      <div>
        <h2 className="font-medium mb-2">Ürünler</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => addItem(p)}
              className="px-3 py-1 border rounded text-sm"
            >
              {p.name || p.title}
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <table className="w-full border text-sm">
            <thead>
              <tr>
                <th className="border p-1">Ürün</th>
                <th className="border p-1">Miktar</th>
                <th className="border p-1">Fiyat</th>
                <th className="border p-1">KDV %</th>
                <th className="border p-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="border p-1">
                    {it.productName}
                  </td>
                  <td className="border p-1">
                    <input
                      type="number"
                      value={it.quantity}
                      min="1"
                      onChange={(e) =>
                        updateItem(i, "quantity", Number(e.target.value))
                      }
                      className="w-16 border"
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      type="number"
                      value={it.unitPrice}
                      onChange={(e) =>
                        updateItem(i, "unitPrice", Number(e.target.value))
                      }
                      className="w-24 border"
                    />
                  </td>
                  <td className="border p-1">
                    {saleType === "official" ? (
                      <input
                        type="number"
                        value={it.vatRate}
                        onChange={(e) =>
                          updateItem(i, "vatRate", Number(e.target.value))
                        }
                        className="w-16 border"
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="border p-1">
                    <button
                      onClick={() => removeItem(i)}
                      className="text-red-600"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button
        onClick={saveSale}
        disabled={saving}
        className="px-4 py-2 bg-black text-white rounded"
      >
        {saving ? "Kaydediliyor..." : "Satışı Kaydet"}
      </button>
    </div>
  );
}
