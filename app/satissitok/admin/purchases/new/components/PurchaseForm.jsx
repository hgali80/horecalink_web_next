// app/satissitok/admin/purchases/new/components/PurchaseForm.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PurchaseItemsTable from "./PurchaseItemsTable";
import { getSettings } from "@/app/satissitok/services/settingsService";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";

/* ===============================
   YARDIMCI FONKSİYONLAR
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

function formatInvoiceNo(type, yy, seq) {
  const prefix = type === "official" ? "R" : "F";
  return `${prefix}-${yy}${pad6(seq)}`;
}

/* ===============================
   COMPONENT
================================ */

export default function PurchaseForm({ onSubmit }) {
  // official | actual
  const [purchaseType, setPurchaseType] = useState("official");

  // inclusive | exclusive
  const [vatMode, setVatMode] = useState("inclusive");

  // 🔹 Cari seçimi
  const [supplierCariId, setSupplierCariId] = useState(null);
  const [cariSearch, setCariSearch] = useState("");
  const [caris, setCaris] = useState([]);
  const [cariOpen, setCariOpen] = useState(false);
  const cariLoadingRef = useRef(false);

  const [supplierName, setSupplierName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [documentDate, setDocumentDate] = useState("");

  const [items, setItems] = useState([]);

  // VAT
  const [vatRates, setVatRates] = useState([]);
  const [selectedVat, setSelectedVat] = useState(16);

  // Kullanıcı elle fatura no değiştirdiyse
  const [invoiceNoDirty, setInvoiceNoDirty] = useState(false);
  const loadingRef = useRef(false);

  /* ===============================
     AYARLARI YÜKLE
  ================================ */

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      const vats = settings?.taxes?.vat || [];
      setVatRates(vats);

      const def = vats.find((v) => v.default === true);
      setSelectedVat(def ? Number(def.rate) : 16);
    };
    loadSettings();
  }, []);

  /* ===============================
     CARİ LİSTESİ (TEDARİKÇİ / BOTH)
  ================================ */

  useEffect(() => {
    const loadCaris = async () => {
      if (cariLoadingRef.current) return;
      cariLoadingRef.current = true;

      try {
        const q = query(
          collection(db, "caris"),
          where("isActive", "==", true),
          where("type", "in", ["supplier", "both"]),
          orderBy("createdAt", "desc"),
          limit(500)
        );

        const snap = await getDocs(q);
        setCaris(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("CARIS LOAD ERROR:", e);
        // İndex yoksa sayfa patlamasın
        // (Bu durumda user console'da görür ve index açarız)
        setCaris([]);
      } finally {
        cariLoadingRef.current = false;
      }
    };

    loadCaris();
  }, []);

  const filteredCaris = useMemo(() => {
    const q = (cariSearch || "").trim().toLowerCase();
    if (!q) return caris;

    return caris.filter((c) => {
      const firm = (c.firm || "").toLowerCase();
      const bin = (c.bin || "").toLowerCase();
      const mobile = (c.mobile || "").toLowerCase();
      return firm.includes(q) || bin.includes(q) || mobile.includes(q);
    });
  }, [caris, cariSearch]);

  const selectCari = (c) => {
    setSupplierCariId(c.id);
    setSupplierName(c.firm || "");
    setCariSearch(c.firm || "");
    setCariOpen(false);
  };

  const clearCari = () => {
    setSupplierCariId(null);
    setCariSearch("");
    // supplierName'i zorla temizlemiyorum: kullanıcı manuel yazıyor olabilir
  };

  /* ===============================
     FATURA TÜRÜ → KDV DAVRANIŞI
  ================================ */

  useEffect(() => {
    if (purchaseType === "actual") {
      setSelectedVat(0);
    } else {
      const def = vatRates.find((v) => v.default === true);
      setSelectedVat(def ? Number(def.rate) : 16);
    }
    setInvoiceNoDirty(false);
  }, [purchaseType]); // eslint-disable-line

  /* ===============================
     FATURA NO OTOMATİK ÜRETİMİ
     (purchase_counters/main)
  ================================ */

  const yy = useMemo(() => year2FromDateISO(documentDate), [documentDate]);

  useEffect(() => {
    const loadNextInvoiceNo = async () => {
      if (invoiceNoDirty) return;
      if (loadingRef.current) return;
      loadingRef.current = true;

      try {
        const ref = doc(db, "purchase_counters", "main");
        const snap = await getDoc(ref);

        const counters = snap.exists()
          ? snap.data()
          : { official: 0, actual: 0 };

        const nextSeq = (counters[purchaseType] || 0) + 1;
        const nextNo = formatInvoiceNo(purchaseType, yy, nextSeq);
        setInvoiceNo(nextNo);
      } catch {
        setInvoiceNo(formatInvoiceNo(purchaseType, yy, 1));
      } finally {
        loadingRef.current = false;
      }
    };

    loadNextInvoiceNo();
  }, [purchaseType, yy, invoiceNoDirty]);

  /* ===============================
     TOPLAMLAR
  ================================ */

  const effectiveVatRate = purchaseType === "official" ? Number(selectedVat || 0) : 0;

  const totals = useMemo(() => {
    const net = items.reduce((s, i) => s + (i.netLineTotal || 0), 0);
    const vat = items.reduce((s, i) => s + (i.vatLineTotal || 0), 0);
    const gross = items.reduce((s, i) => s + (i.grossLineTotal || 0), 0);

    return {
      net: Math.round(net * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      gross: Math.round(gross * 100) / 100,
    };
  }, [items]);

  /* ===============================
     SUBMIT
  ================================ */

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!supplierName || !documentDate || items.length === 0) {
      alert("Lütfen gerekli alanları doldurun.");
      return;
    }

    onSubmit({
      supplierName: supplierName.trim(),
      supplierCariId: supplierCariId || null,

      invoiceNo: invoiceNo.trim(),
      documentDate,
      purchaseType,
      vatMode,
      taxRate: effectiveVatRate,
      items,
      totals: {
        net: totals.net,
        tax: totals.vat,
        gross: totals.gross,
      },
    });
  };

  const showVatControls = purchaseType === "official";
  const hideVatColumns = purchaseType === "actual";

  /* ===============================
     RENDER
  ================================ */

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ÜST BİLGİLER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FATURA TÜRÜ */}
        <div>
          <label className="block text-sm font-medium mb-1">Fatura Türü</label>
          <div className="flex gap-6">
            <label>
              <input
                type="radio"
                checked={purchaseType === "official"}
                onChange={() => setPurchaseType("official")}
              />{" "}
              Resmi
            </label>
            <label>
              <input
                type="radio"
                checked={purchaseType === "actual"}
                onChange={() => setPurchaseType("actual")}
              />{" "}
              Fiili
            </label>
          </div>
        </div>

        {/* CARİ SEÇ (TEDARİKÇİ) */}
        <div className="relative">
          <label className="block text-sm font-medium mb-1">
            Cari Seç (Tedarikçi){" "}
            {supplierCariId ? (
              <span className="text-xs text-green-700">Seçildi</span>
            ) : (
              <span className="text-xs text-gray-500">Opsiyonel</span>
            )}
          </label>

          <div className="flex gap-2">
            <input
              className="w-full border rounded px-3 py-2"
              value={cariSearch}
              placeholder="Firma / BIN / Telefon ile ara..."
              onFocus={() => setCariOpen(true)}
              onBlur={() => setTimeout(() => setCariOpen(false), 150)}
              onChange={(e) => {
                setCariSearch(e.target.value);
                setCariOpen(true);
                // kullanıcı arama değiştirirse, önceki seçimi iptal edelim
                if (supplierCariId) setSupplierCariId(null);
              }}
            />
            <button
              type="button"
              className="px-3 py-2 border rounded"
              onClick={clearCari}
              title="Cari seçimini temizle"
            >
              Temizle
            </button>
          </div>

          {cariOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border w-full z-50 max-h-64 overflow-y-auto rounded">
              {filteredCaris.map((c) => (
                <div
                  key={c.id}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectCari(c);
                  }}
                >
                  <div className="font-medium">{c.firm || "-"}</div>
                  <div className="text-xs text-gray-600">
                    {c.bin ? `BIN: ${c.bin}` : "BIN: -"}{" "}
                    {c.mobile ? `• Tel: ${c.mobile}` : ""}
                  </div>
                </div>
              ))}

              {filteredCaris.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-500">
                  Cari bulunamadı. (Önce cari kart oluşturmalısın.)
                </div>
              )}
            </div>
          )}
        </div>

        {/* TEDARİKÇİ (GERİ UYUMLU) */}
        <div>
          <label className="block text-sm font-medium mb-1">Tedarikçi</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Manuel yazılabilir (cari seçersen otomatik dolar)"
          />
          <div className="text-xs text-gray-500 mt-1">
            Not: Cari seçersen, kayıtta <strong>supplierCariId</strong> de gider.
          </div>
        </div>

        {/* FATURA NO */}
        <div>
          <label className="block text-sm font-medium mb-1">Fatura No</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={invoiceNo}
            onChange={(e) => {
              setInvoiceNo(e.target.value);
              setInvoiceNoDirty(true);
            }}
          />
        </div>

        {/* TARİH */}
        <div>
          <label className="block text-sm font-medium mb-1">Fatura Tarihi</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
          />
        </div>

        {/* KDV */}
        {showVatControls && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">KDV Tipi</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={vatMode}
                onChange={(e) => setVatMode(e.target.value)}
              >
                <option value="inclusive">Dahil</option>
                <option value="exclusive">Hariç</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">KDV Oranı</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedVat}
                onChange={(e) => setSelectedVat(Number(e.target.value))}
              >
                {vatRates.map((v, i) => (
                  <option key={i} value={v.rate}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* ÜRÜNLER */}
      <PurchaseItemsTable
        onChange={setItems}
        vatRate={effectiveVatRate}
        vatMode={vatMode}
        hideVat={hideVatColumns}
      />

      {/* TOPLAM */}
      <div className="border-t pt-4 text-right space-y-1">
        <div>
          Net: <strong>{totals.net} ₸</strong>
        </div>
        <div>
          KDV: <strong>{totals.vat} ₸</strong>
        </div>
        <div className="text-lg">
          Genel Toplam: <strong>{totals.gross} ₸</strong>
        </div>
      </div>

      <div className="text-right">
        <button className="px-4 py-2 bg-green-600 text-white rounded">
          Satınalma Kaydet
        </button>
      </div>
    </form>
  );
}
