// app/satissitok/admin/sales/new/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { collection, getDocs, query, orderBy, doc, runTransaction } from "firebase/firestore";
import { db } from "@/firebase";

import SaleForm from "./components/SaleForm";
import { createSale } from "@/app/satissitok/services/saleService";
import { getSettings } from "@/app/satissitok/services/settingsService";

export default function NewSalePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState([]);
  const [caris, setCaris] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, c, s] = await Promise.all([loadProducts(), loadCaris(), getSettings()]);
      setProducts(p);
      setCaris(c);
      setSettings(s);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    const snap = await getDocs(query(collection(db, "products"), orderBy("name")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function loadCaris() {
    const snap = await getDocs(query(collection(db, "caris"), orderBy("firm")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function handleSubmit(payload) {
    if (saving) return;

    setSaving(true);
    try {
      let finalInvoiceNo = payload.invoiceNo;

      // Eğer kullanıcı manuel numara girmemişse, kayıt anında sayacı artırarak numara al
      if (!payload.invoiceNoDirty) {
        await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, "sale_counters", "main");
          const counterSnap = await transaction.get(counterRef);

          if (!counterSnap.exists()) {
            throw new Error("Sayaç dökümanı (sale_counters/main) bulunamadı!");
          }

          const counters = counterSnap.data();
          const nextSeq = (Number(counters[payload.saleType]) || 0) + 1;

          // Yıl ve Format belirleme (SR-26000001 formatı için)
          const yy = String(new Date().getFullYear()).slice(-2);
          const prefix = payload.saleType === "official" ? "SR" : "SF";
          finalInvoiceNo = `${prefix}-${yy}${String(nextSeq).padStart(6, "0")}`;

          // Veritabanındaki sayacı hemen güncelle
          transaction.update(counterRef, {
            [payload.saleType]: nextSeq,
          });
        });
      }

      // Güncellenmiş veriyle satışı oluştur
      const res = await createSale({
        ...payload,
        invoiceNo: finalInvoiceNo,
      });

      if (!res?.saleId) {
        throw new Error("Satış kaydı oluşturuldu ama saleId dönmedi.");
      }

      router.push(`/satissitok/admin/sales/${res.saleId}`);
    } catch (e) {
      console.error("SALE_CREATE_ERROR:", e);
      alert(e?.message || "Satış kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Yeni Satış</h1>

      <SaleForm
        products={products}
        caris={caris}
        settings={settings}
        onSubmit={handleSubmit}
        disabled={saving}
      />
    </div>
  );
}