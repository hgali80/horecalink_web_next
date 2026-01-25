// app/satissitok/admin/purchases/new/components/PurchaseForm.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PurchaseItemsTable from "./PurchaseItemsTable";
import { getSettings } from "@/app/satissitok/services/settingsService";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";

function pad6(n) {
  const x = Number(n) || 0;
  return String(x).padStart(6, "0");
}

function year2FromDateISO(dateISO) {
  if (!dateISO) return String(new Date().getFullYear()).slice(-2);
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return String(new Date().getFullYear()).slice(-2);
  return String(d.getFullYear()).slice(-2);
}

function parseSequence(docNo, expectedPrefix) {
  // expectedPrefix: "R-26" or "F-26"
  // format: R-26000001
  if (!docNo || !docNo.startsWith(expectedPrefix)) return null;
  const tail = docNo.replace(expectedPrefix, "");
  const n = Number(tail);
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function PurchaseForm({ onSubmit }) {
  // official | actual
  const [purchaseType, setPurchaseType] = useState("official");

  // KDV modu üstten
  // inclusive: girilen fiyat BRÜT
  // exclusive: girilen fiyat NET
  const [vatMode, setVatMode] = useState("inclusive");

  const [supplierName, setSupplierName] = useState("");
  const [documentNo, setDocumentNo] = useState("");
  const [documentDate, setDocumentDate] = useState("");

  const [items, setItems] = useState([]);

  // AYARLARDAN GELENLER
  const [vatRates, setVatRates] = useState([]);
  const [selectedVat, setSelectedVat] = useState(16);

  // Belge no otomasyonunu kullanıcı bozmadan yürütmek için:
  const [docNoDirty, setDocNoDirty] = useState(false);
  const generatingRef = useRef(false);

  // Ayarları yükle
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      const vats = settings?.taxes?.vat || [];
      setVatRates(vats);

      // default varsa onu al, yoksa 16
      const def = vats.find((v) => v.default === true);
      const defRate = def ? Number(def.rate) : 16;
      setSelectedVat(Number.isFinite(defRate) ? defRate : 16);
    };
    loadSettings();
  }, []);

  // Fiili seçilince KDV sıfırlansın
  useEffect(() => {
    if (purchaseType === "actual") {
      setSelectedVat(0);
    } else {
      // Resmiye dönerse; ayarlardaki default'u tekrar dene
      // (vatRates daha sonra geldiyse de çalışsın diye)
      const def = vatRates.find((v) => v.default === true);
      const defRate = def ? Number(def.rate) : 16;
      setSelectedVat(Number.isFinite(defRate) ? defRate : 16);
    }
    // satınalma türü değişince docNo'yu otomatik üretmeye tekrar izin verelim
    setDocNoDirty(false);
  }, [purchaseType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resmi/Fiili için prefix belirle
  const yy = useMemo(() => year2FromDateISO(documentDate), [documentDate]);
  const docPrefix = useMemo(() => {
    return purchaseType === "official" ? `R-${yy}` : `F-${yy}`;
  }, [purchaseType, yy]);

  // Otomatik belge no üret
  useEffect(() => {
    const generate = async () => {
      if (docNoDirty) return; // kullanıcı elle değiştirdiyse dokunma
      if (generatingRef.current) return;
      generatingRef.current = true;

      try {
        // Tür bazlı + yıl bazlı son numarayı bulacağız
        // Firestore startsWith yok; bu yüzden son 50 kaydı çekip parse ediyoruz.
        const qy = query(
          collection(db, "purchases"),
          where("purchaseType", "==", purchaseType),
          orderBy("createdAt", "desc"),
          limit(50)
        );

        const snap = await getDocs(qy);
        let maxSeq = 0;

        snap.docs.forEach((d) => {
          const data = d.data();
          const dn = data?.documentNo || "";
          const seq = parseSequence(dn, docPrefix);
          if (seq && seq > maxSeq) maxSeq = seq;
        });

        const nextSeq = maxSeq + 1;
        const nextDocNo = `${docPrefix}${pad6(nextSeq)}`;
        setDocumentNo(nextDocNo);
      } catch (e) {
        // Sessiz fallback: en azından prefix + 000001
        setDocumentNo(`${docPrefix}${pad6(1)}`);
      } finally {
        generatingRef.current = false;
      }
    };

    generate();
  }, [docPrefix, purchaseType, docNoDirty]);

  // effective vat rate
  const effectiveVatRate = purchaseType === "official" ? Number(selectedVat || 0) : 0;

  // Toplamlar (items içindeki hesaplanmış alanlardan)
  const totals = useMemo(() => {
    const net = items.reduce((sum, item) => sum + (Number(item.netLineTotal) || 0), 0);
    const vat = items.reduce((sum, item) => sum + (Number(item.vatLineTotal) || 0), 0);
    const gross = items.reduce((sum, item) => sum + (Number(item.grossLineTotal) || 0), 0);

    return {
      net: Math.round(net * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      gross: Math.round(gross * 100) / 100,
    };
  }, [items]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!supplierName || !documentDate || items.length === 0) {
      alert("Lütfen gerekli alanları doldurun.");
      return;
    }

    const payload = {
      supplierName: supplierName.trim(),
      documentNo: (documentNo || "").trim(),
      documentDate,
      purchaseType, // official | actual
      vatMode, // inclusive | exclusive
      taxRate: effectiveVatRate,
      items,
      totals: {
        net: totals.net,
        tax: totals.vat,
        gross: totals.gross,
      },
    };

    onSubmit(payload);
  };

  const showVatControls = purchaseType === "official";
  const hideVatColumns = purchaseType === "actual";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ÜST BİLGİLER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fatura Türü */}
        <div>
          <label className="block text-sm font-medium mb-1">Fatura Türü</label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={purchaseType === "official"}
                onChange={() => setPurchaseType("official")}
              />
              Resmi
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={purchaseType === "actual"}
                onChange={() => setPurchaseType("actual")}
              />
              Fiili
            </label>
          </div>
        </div>

        {/* Tedarikçi */}
        <div>
          <label className="block text-sm font-medium mb-1">Tedarikçi</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
        </div>

        {/* Belge No */}
        <div>
          <label className="block text-sm font-medium mb-1">Belge No</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={documentNo}
            onChange={(e) => {
              setDocumentNo(e.target.value);
              setDocNoDirty(true);
            }}
            placeholder={`${docPrefix}${pad6(1)}`}
          />
          <div className="text-xs text-gray-600 mt-1">
            Varsayılan format: <strong>{purchaseType === "official" ? "R" : "F"}-{yy}000001</strong>
          </div>
        </div>

        {/* Belge Tarihi */}
        <div>
          <label className="block text-sm font-medium mb-1">Belge Tarihi</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
          />
        </div>

        {/* KDV Modu + KDV Oranı (SADECE RESMİ) */}
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
              <div className="text-xs text-gray-600 mt-1">
                Dahil: girilen fiyat brüt; Hariç: girilen fiyat net kabul edilir.
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">KDV Oranı</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedVat}
                onChange={(e) => setSelectedVat(Number(e.target.value))}
              >
                {vatRates.length > 0 ? (
                  vatRates.map((v, i) => (
                    <option key={i} value={v.rate}>
                      {v.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={16}>%16</option>
                    <option value={0}>%0</option>
                  </>
                )}
              </select>
            </div>
          </>
        )}
      </div>

      {/* ÜRÜN KALEMLERİ */}
      <PurchaseItemsTable
        onChange={setItems}
        vatRate={effectiveVatRate}
        vatMode={vatMode}
        hideVat={hideVatColumns}
      />

      {/* TOPLAMLAR */}
      <div className="border-t pt-4 space-y-2 text-right">
        <div>
          Net Toplam: <strong>{totals.net.toLocaleString()} ₸</strong>
        </div>
        <div>
          KDV: <strong>{totals.vat.toLocaleString()} ₸</strong>
        </div>
        <div className="text-lg">
          Genel Toplam: <strong>{totals.gross.toLocaleString()} ₸</strong>
        </div>
      </div>

      {/* KAYDET */}
      <div className="text-right">
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Satınalma Kaydet
        </button>
      </div>
    </form>
  );
}
