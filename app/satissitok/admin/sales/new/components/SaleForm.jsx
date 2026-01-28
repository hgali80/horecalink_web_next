// app/satissitok/admin/sales/new/components/SaleForm.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SaleItemsTable from "./SaleItemsTable";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

/* ===============================
   INVOICE NO HELPERS (SALE)
================================ */

function pad6(n) {
  return String(Number(n) || 0).padStart(6, "0");
}

function year2FromDateISO(dateISO) {
  if (!dateISO) return String(new Date().getFullYear()).slice(-2);
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime())
    ? String(new Date().getFullYear()).slice(-2)
    : String(d.getFullYear()).slice(-2);
}

function formatInvoiceNo(saleType, yy, seq) {
  const prefix = saleType === "official" ? "SR" : "SF";
  return `${prefix}-${yy}${pad6(seq)}`;
}

export default function SaleForm({ products, caris, settings, onSubmit }) {
  const [saleType, setSaleType] = useState("official"); // official|actual
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // satış kanalı
  const [platformId, setPlatformId] = useState("");
  const [cariId, setCariId] = useState("");

  const [vatMode, setVatMode] = useState("exclude");
  const [vatRate, setVatRate] = useState(0);

  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // invoice no (auto + manual)
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceNoAuto, setInvoiceNoAuto] = useState("");
  const [invoiceNoDirty, setInvoiceNoDirty] = useState(false);
  const invoiceLoadingRef = useRef(false);

  /* ===============================
     DEFAULTS (platform + KDV)
  ================================ */
  useEffect(() => {
    const defaultPlatform =
      settings?.platforms?.find((x) => x.default && x.active !== false) ||
      settings?.platforms?.find((x) => x.active !== false);

    if (!platformId && defaultPlatform?.key) {
      setPlatformId(defaultPlatform.key);
    }

    const defaultVat =
      settings?.taxes?.vat?.find((x) => x.default && x.active !== false) ||
      settings?.taxes?.vat?.find((x) => x.active !== false);

    if (saleType === "official") {
      setVatRate(Number(defaultVat?.rate ?? 0));
    } else {
      setVatMode("exclude");
      setVatRate(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, saleType]);

  /* ===============================
     INVOICE NO AUTO LOAD
  ================================ */
  const yy = useMemo(() => year2FromDateISO(invoiceDate), [invoiceDate]);

  useEffect(() => {
    const loadNextInvoiceNo = async () => {
      if (invoiceNoDirty) return;
      if (invoiceLoadingRef.current) return;
      invoiceLoadingRef.current = true;

      try {
        const ref = doc(db, "sale_counters", "main");
        const snap = await getDoc(ref);
        const counters = snap.exists() ? snap.data() : { official: 0, actual: 0 };
        const nextSeq = Number(counters[saleType] || 0) + 1;

        const nextNo = formatInvoiceNo(saleType, yy, nextSeq);
        setInvoiceNo(nextNo);
        setInvoiceNoAuto(nextNo);
      } catch {
        const fallback = formatInvoiceNo(saleType, yy, 1);
        setInvoiceNo(fallback);
        setInvoiceNoAuto(fallback);
      } finally {
        invoiceLoadingRef.current = false;
      }
    };

    loadNextInvoiceNo();
  }, [saleType, yy, invoiceNoDirty]);

  /* ===============================
     TOTALS
  ================================ */
  const totals = useMemo(() => {
    let net = 0,
      vat = 0,
      total = 0;
    for (const r of items) {
      net += Number(r.net || 0);
      vat += Number(r.vat || 0);
      total += Number(r.total || 0);
    }
    return { net, vat, total };
  }, [items]);

  /* ===============================
     NEGATIVE STOCK WARNING (AŞAMA 2.2)
  ================================ */
  const negativeItems = useMemo(() => {
    const soldMap = {};

    for (const r of items) {
      if (!r.productId || !r.quantity) continue;
      soldMap[r.productId] =
        (soldMap[r.productId] || 0) + Number(r.quantity || 0);
    }

    return Object.entries(soldMap)
      .map(([productId, sold]) => {
        const p = products.find((x) => x.id === productId);
        const bucket =
          saleType === "official"
            ? p?.stock_balances?.official
            : p?.stock_balances?.actual;

        const available = Number(bucket?.qty ?? 0);
        return {
          productId,
          name: p?.name || "—",
          available,
          sold,
        };
      })
      .filter((x) => x.sold > x.available);
  }, [items, products, saleType]);

  /* ===============================
     SUBMIT
  ================================ */
  const canSubmit =
    !submitting &&
    platformId &&
    cariId &&
    items.length > 0 &&
    items.every((r) => r.productId && Number(r.quantity) > 0) &&
    String(invoiceNo || "").trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      // Sadece gerekli verileri yukarıdaki (page.jsx) onSubmit'e gönderiyoruz
      await onSubmit({
        saleType,
        invoiceDate,
        platformId,
        saleChannel: platformId,
        cariId,
        invoiceNo: invoiceNo.trim(),
        invoiceNoDirty, // Otomatik numara mı kullanılsın kararı için kritik
        vatMode,
        vatRate,
        items,
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* ===============================
     RENDER
  ================================ */
  return (
    <div className="space-y-6">
      {/* ÜST FORM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded">
        <div>
          <label>Satış Türü</label>
          <select
            className="w-full border p-2"
            value={saleType}
            onChange={(e) => {
              setSaleType(e.target.value);
              setInvoiceNoDirty(false);
            }}
          >
            <option value="official">Resmi</option>
            <option value="actual">Fiili</option>
          </select>
        </div>

        <div>
          <label>Fatura No</label>
          <input
            className="w-full border p-2"
            value={invoiceNo}
            onChange={(e) => {
              setInvoiceNo(e.target.value);
              setInvoiceNoDirty(true);
            }}
            placeholder="SR-26000001 / SF-26000001"
          />
          {!invoiceNoDirty && invoiceNo && (
            <div className="text-xs text-gray-500 mt-1">
              Otomatik üretildi (istersen manuel değiştirebilirsin).
            </div>
          )}
          {invoiceNoDirty && invoiceNoAuto && (
            <div className="text-xs text-gray-500 mt-1">
              Sistem önerisi: {invoiceNoAuto}
            </div>
          )}
        </div>

        <div>
          <label>Fatura Tarihi</label>
          <input
            type="date"
            className="w-full border p-2"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>

        <div>
          <label>Satış Platformu *</label>
          <select
            className="w-full border p-2"
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
          >
            <option value="">Seçiniz</option>
            {(settings?.platforms || [])
              .filter((p) => p.active !== false)
              .map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label>Cari / Müşteri *</label>
          <select
            className="w-full border p-2"
            value={cariId}
            onChange={(e) => setCariId(e.target.value)}
          >
            <option value="">Cari seçiniz</option>
            {caris.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firm}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KDV */}
      {saleType === "official" && (
        <div className="grid grid-cols-2 gap-4 border p-4 rounded">
          <div>
            <label>KDV Tipi</label>
            <select
              className="w-full border p-2"
              value={vatMode}
              onChange={(e) => setVatMode(e.target.value)}
            >
              <option value="exclude">Hariç</option>
              <option value="include">Dahil</option>
            </select>
          </div>

          <div>
            <label>Varsayılan KDV (%)</label>
            <input
              className="w-full border p-2 bg-gray-100"
              value={vatRate}
              readOnly
            />
          </div>
        </div>
      )}

      {/* ÜRÜNLER */}
      <SaleItemsTable
        items={items}
        setItems={setItems}
        products={products}
        vatRate={vatRate}
        vatMode={vatMode}
        saleType={saleType}
      />

      <button
        type="button"
        className="border px-3 py-2 rounded"
        onClick={() =>
          setItems((p) => [
            ...p,
            {
              productId: "",
              productName: "",
              quantity: "",
              unit: "",
              unitPrice: "",
              discountRate: 0,
              net: 0,
              vat: 0,
              total: 0,
            },
          ])
        }
      >
        + Satır Ekle
      </button>

      {/* 🔴 STOK UYARI ÖZETİ */}
      {negativeItems.length > 0 && (
        <div className="border border-red-400 bg-red-50 p-3 rounded text-sm text-red-700">
          <b>Uyarı:</b> Aşağıdaki ürünlerde stok yetersiz. Satış devam edebilir.
          <ul className="list-disc ml-5 mt-1">
            {negativeItems.map((n) => (
              <li key={n.productId}>
                {n.name}: mevcut {n.available}, satılan {n.sold}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* TOTALS */}
      <div className="grid grid-cols-3 gap-4 border p-4 rounded">
        <div>Net: {totals.net.toFixed(2)}</div>
        <div>KDV: {totals.vat.toFixed(2)}</div>
        <div>Genel: {totals.total.toFixed(2)}</div>
      </div>

      <button
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`px-4 py-2 text-white rounded ${
          canSubmit ? "bg-black" : "bg-gray-400"
        }`}
      >
        Satışı Kaydet
      </button>
    </div>
  );
}
