// app/satissitok/admin/sales/new/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase";

import SaleForm from "./components/SaleForm";
import { createSale } from "@/app/satissitok/services/saleService";
import { getSettings } from "@/app/satissitok/services/settingsService";

export default function NewSalePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

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
    const res = await createSale(payload);
    router.push(`/satissitok/admin/sales/${res.saleId}`);
  }

  if (loading) return <div className="p-6 text-sm">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Yeni Satış</h1>

      <SaleForm products={products} caris={caris} settings={settings} onSubmit={handleSubmit} />
    </div>
  );
}
