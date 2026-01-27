//app/satissitok/admin/sales/new/page.jsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase";

import SaleForm from "./components/SaleForm";
import { createSale } from "@/app/satissitok/services/saleService";

export default function NewSalePage() {
  const router = useRouter();

  // -----------------------------
  // STATE
  // -----------------------------
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [caris, setCaris] = useState([]);
  const [units, setUnits] = useState([]);

  const [settings, setSettings] = useState({
    defaultVatRate: 0,
  });

  // -----------------------------
  // INITIAL LOAD
  // -----------------------------
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([
        loadProducts(),
        loadCaris(),
        loadUnits(),
        loadSettings(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // LOADERS
  // -----------------------------
  async function loadProducts() {
    const snap = await getDocs(
      query(collection(db, "products"), orderBy("name"))
    );

    setProducts(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }

  async function loadCaris() {
    const snap = await getDocs(
      query(collection(db, "caris"), orderBy("firm"))
    );

    setCaris(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }

  async function loadUnits() {
    // Basitlik için settings koleksiyonundan alıyoruz
    // Yoksa fallback array
    const snap = await getDocs(collection(db, "satissitok_settings"));

    if (!snap.empty) {
      const data = snap.docs[0].data();
      setUnits(data.units || []);
    } else {
      setUnits([]);
    }
  }

  async function loadSettings() {
    const snap = await getDocs(collection(db, "satissitok_settings"));
    if (!snap.empty) {
      const data = snap.docs[0].data();
      setSettings({
        defaultVatRate: Number(data.defaultVatRate || 0),
      });
    }
  }

  // -----------------------------
  // SUBMIT
  // -----------------------------
  async function handleSubmit(payload) {
    const res = await createSale(payload);

    // başarılı → satış detayına git
    router.push(
      `/satissitok/admin/sales/${res.saleId}`
    );
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  if (loading) {
    return (
      <div className="p-6 text-sm">
        Yükleniyor…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">
        Yeni Satış
      </h1>

      <SaleForm
        products={products}
        units={units}
        caris={caris}
        settings={settings}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
