// app/satissitok/admin/finance/accounts/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, PlusCircle } from "lucide-react";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

export default function AccountsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("Nakit");
  const [type, setType] = useState("cash");
  const [isDefault, setIsDefault] = useState(true);
  const [active, setActive] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "cash_accounts"), orderBy("name")));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (saving) return;
    const n = (name || "").trim();
    if (!n) return alert("İsim zorunlu");

    setSaving(true);
    try {
      await addDoc(collection(db, "cash_accounts"), {
        name: n,
        type,
        currency: "KZT",
        default: Boolean(isDefault),
        active: Boolean(active),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await load();
      alert("Hesap eklendi");
    } catch (e) {
      console.error("ACCOUNT_ADD_ERROR:", e);
      alert(e?.message || "Hata");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Geri"
          title="Geri"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Satış/Stok Ana Sayfa"
          title="Satış/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>

        <Link
          href="/satissitok/admin/finance"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Finans"
          title="Finans"
        >
          <span className="text-sm font-semibold">Finans</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Kasa/Banka Hesapları</h1>
        <div className="text-sm text-gray-600 mt-1">
          İlk kurulum için en az 1 adet <strong>Nakit</strong> hesabı olmalı.
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm mb-1">İsim</label>
            <input className="border px-3 py-2 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Tip</label>
            <select className="border px-3 py-2 w-full" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="cash">cash</option>
              <option value="bank">bank</option>
              <option value="kaspi">kaspi</option>
              <option value="card">card</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              default
            </label>
          </div>
          <div className="flex items-end gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              active
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={add}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-60"
          >
            <PlusCircle size={18} />
            Hesap Ekle
          </button>
        </div>
      </div>

      {loading ? (
        <div>Yükleniyor…</div>
      ) : (
        <table className="w-full border border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2">ID</th>
              <th className="border px-2 py-2">İsim</th>
              <th className="border px-2 py-2">Tip</th>
              <th className="border px-2 py-2">Default</th>
              <th className="border px-2 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="border px-2 py-1 font-mono text-xs">{r.id}</td>
                <td className="border px-2 py-1">{r.name}</td>
                <td className="border px-2 py-1 text-center">{r.type}</td>
                <td className="border px-2 py-1 text-center">{r.default ? "✅" : ""}</td>
                <td className="border px-2 py-1 text-center">{r.active !== false ? "✅" : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="border px-3 py-6 text-center text-gray-500">
                  Hesap yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
