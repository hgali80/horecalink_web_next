// app/satissitok/admin/finance/pay/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Save } from "lucide-react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";

import { listCashAccounts, getDefaultCashAccountId } from "@/app/satissitok/services/cashAccountService";
import { createCashMovement } from "@/app/satissitok/services/financeService";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export default function PayPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [caris, setCaris] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState("");

  // form
  const [mode, setMode] = useState("payment"); // payment | advance
  const [cariId, setCariId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("cash");
  const [accountId, setAccountId] = useState("");
  const [operationDate, setOperationDate] = useState(todayISO());
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cSnap = await getDocs(query(collection(db, "caris"), orderBy("firm")));
        setCaris(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const acc = await listCashAccounts();
        setAccounts(acc);
        const defId = (await getDefaultCashAccountId()) || (acc[0]?.id ?? "");
        setDefaultAccountId(defId);
        setAccountId(defId);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedCari = useMemo(
    () => caris.find((c) => c.id === cariId) || null,
    [caris, cariId]
  );

  async function onSave() {
    if (saving) return;

    const amt = Math.round(num(amount) * 100) / 100;
    if (!cariId) return alert("Cari seç");
    if (!(amt > 0)) return alert("Tutar gir");
    if (!accountId) return alert("Hesap seç (varsayılan: Nakit)");

    setSaving(true);
    try {
      const res = await createCashMovement({
        kind: "pay",
        mode: mode === "advance" ? "advance" : "payment",
        cariId,
        amount: amt,
        method,
        accountId,
        operationDate,
        invoiceId: invoiceId.trim() || null,
        invoiceNo: invoiceNo.trim() || null,
        description: description.trim() || null,
      });

      alert(`Kaydedildi. Makbuz: ${res?.receiptNo || "-"}`);
      router.push(`/satissitok/admin/cari/${cariId}`);
    } catch (e) {
      console.error("PAY_SAVE_ERROR:", e);
      alert(e?.message || "Kayıt sırasında hata");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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
        <h1 className="text-2xl font-bold">Ödeme</h1>
        <div className="text-sm text-gray-600 mt-1">
          {selectedCari ? <strong>{selectedCari.firm}</strong> : "Cari seç"}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Tür</label>
            <select className="border px-3 py-2 w-full" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="payment">Ödeme</option>
              <option value="advance">Avans</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Tarih</label>
            <input
              type="date"
              className="border px-3 py-2 w-full"
              value={operationDate}
              onChange={(e) => setOperationDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Cari</label>
            <select className="border px-3 py-2 w-full" value={cariId} onChange={(e) => setCariId(e.target.value)}>
              <option value="">Seç…</option>
              {caris.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firm}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Tutar (₸)</label>
            <input
              type="number"
              className="border px-3 py-2 w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Yöntem</label>
            <select className="border px-3 py-2 w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Nakit</option>
              <option value="bank">Banka</option>
              <option value="kaspi">Kaspi</option>
              <option value="card">Kart</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Hesap (default: Nakit)</label>
            <select
              className="border px-3 py-2 w-full"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Seç…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.default ? "(default)" : ""}
                </option>
              ))}
            </select>
            {!accountId && defaultAccountId ? (
              <div className="text-xs text-gray-500 mt-1">
                Varsayılan hesap bulunamadıysa önce Finans → Hesaplar’dan “Nakit” hesabı oluştur.
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Bağlı Fatura ID (opsiyonel)</label>
            <input
              className="border px-3 py-2 w-full"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              placeholder="purchaseId (opsiyonel)"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Fatura No (opsiyonel)</label>
            <input
              className="border px-3 py-2 w-full"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="PR-26-000001"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Açıklama</label>
          <input
            className="border px-3 py-2 w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Not…"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60"
          >
            <Save size={18} />
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
