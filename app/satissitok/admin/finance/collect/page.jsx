"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Home, Save } from "lucide-react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";
import {
  getDefaultCashAccountId,
  listCashAccounts,
} from "@/app/satissitok/services/cashAccountService";
import { createCashMovement } from "@/app/satissitok/services/financeService";
import { listOpenDocumentsByCari } from "@/app/satissitok/services/documentSettlementService";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export default function CollectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = searchParams.get("mode") === "advance" ? "advance" : "payment";
  const prefillCariId = searchParams.get("cariId") || "";
  const prefillInvoiceId = searchParams.get("invoiceId") || "";
  const prefillInvoiceNo = searchParams.get("invoiceNo") || "";
  const prefillAmount = searchParams.get("amount") || "";
  const returnTo = searchParams.get("returnTo") || "";
  const lockCari = searchParams.get("lockCari") === "1";
  const lockInvoice = searchParams.get("lockInvoice") === "1";
  const lockAmount = searchParams.get("lockAmount") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [caris, setCaris] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [openDocuments, setOpenDocuments] = useState([]);

  const [mode, setMode] = useState(initialMode);
  const [cariId, setCariId] = useState(prefillCariId);
  const [amount, setAmount] = useState(prefillAmount || 0);
  const [method, setMethod] = useState("cash");
  const [accountId, setAccountId] = useState("");
  const [operationDate, setOperationDate] = useState(todayISO());
  const [invoiceId, setInvoiceId] = useState(prefillInvoiceId);
  const [invoiceNo, setInvoiceNo] = useState(prefillInvoiceNo);
  const [description, setDescription] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cSnap = await getDocs(query(collection(db, "caris"), orderBy("firm")));
        setCaris(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const acc = await listCashAccounts();
        setAccounts(acc);
        const defId = (await getDefaultCashAccountId()) || acc[0]?.id || "";
        setAccountId(defId);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!prefillCariId && !prefillInvoiceId && !prefillInvoiceNo && !prefillAmount) return;
    setMode(initialMode);
    setCariId(prefillCariId);
    setInvoiceId(prefillInvoiceId);
    setInvoiceNo(prefillInvoiceNo);
    setAmount(prefillAmount || 0);
  }, [initialMode, prefillAmount, prefillCariId, prefillInvoiceId, prefillInvoiceNo]);

  useEffect(() => {
    const loadOpenDocs = async () => {
      if (!cariId || mode === "advance") {
        setOpenDocuments([]);
        setInvoiceId("");
        return;
      }

      const docs = await listOpenDocumentsByCari({ kind: "sale", cariId });
      setOpenDocuments(docs);
    };

    loadOpenDocs();
  }, [cariId, mode]);

  const selectedCari = useMemo(() => caris.find((c) => c.id === cariId) || null, [caris, cariId]);
  const selectedDocument = useMemo(
    () => openDocuments.find((doc) => doc.id === invoiceId) || null,
    [openDocuments, invoiceId]
  );

  useEffect(() => {
    if (!selectedDocument || mode === "advance") return;
    setInvoiceNo(selectedDocument.invoiceNo || "");
    if (!(num(amount) > 0)) {
      setAmount(selectedDocument.outstandingAmount || 0);
    }
  }, [selectedDocument, mode]);

  useEffect(() => {
    if (!prefillInvoiceId || mode === "advance" || openDocuments.length === 0) return;

    const matched = openDocuments.find((doc) => doc.id === prefillInvoiceId);
    if (!matched) return;

    setInvoiceId(matched.id);
    setInvoiceNo(matched.invoiceNo || prefillInvoiceNo || "");
    setAmount(prefillAmount !== "" ? prefillAmount : matched.outstandingAmount || 0);
  }, [mode, openDocuments, prefillAmount, prefillInvoiceId, prefillInvoiceNo]);

  async function onSave() {
    if (saving) return;

    const amt = Math.round(num(amount) * 100) / 100;
    if (!cariId) return alert("Cari sec");
    if (!(amt > 0)) return alert("Tutar gir");
    if (!accountId) return alert("Hesap sec");

    if (selectedDocument && amt > num(selectedDocument.outstandingAmount)) {
      return alert("Tahsilat tutari acik belge tutarini asamaz");
    }

    setSaving(true);
    try {
      const res = await createCashMovement({
        kind: "collect",
        mode: mode === "advance" ? "advance" : "payment",
        cariId,
        amount: amt,
        method,
        accountId,
        operationDate,
        invoiceId: invoiceId || null,
        invoiceNo: invoiceNo.trim() || null,
        invoiceKind: "sale",
        description: description.trim() || null,
      });

      alert(`Kaydedildi. Makbuz: ${res?.receiptNo || "-"}`);
      router.push(returnTo || `/satissitok/admin/cari/${cariId}`);
    } catch (e) {
      console.error("COLLECT_SAVE_ERROR:", e);
      alert(e?.message || "Kayit sirasinda hata");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Yukleniyor...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link href="/satissitok/admin" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>

        <Link href="/satissitok/admin/finance" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
          <span className="text-sm font-semibold">Finans</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Tahsilat</h1>
        <div className="text-sm text-gray-600 mt-1">
          {selectedCari ? <strong>{selectedCari.firm}</strong> : "Cari sec"}
        </div>
      </div>

      {(lockCari || lockInvoice || lockAmount) && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Satis ekranindan yonlendirilen tahsilat akisi acildi. Cari, belge ve/veya tutar alanlari kontrollu olarak on dolduruldu.
        </div>
      )}

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <div className="text-sm mb-1">Tur</div>
            <select className="border px-3 py-2 w-full disabled:bg-gray-100 disabled:text-gray-500" value={mode} onChange={(e) => setMode(e.target.value)} disabled={lockInvoice}>
              <option value="payment">Tahsilat</option>
              <option value="advance">Avans</option>
            </select>
          </label>

          <label>
            <div className="text-sm mb-1">Tarih</div>
            <input type="date" className="border px-3 py-2 w-full" value={operationDate} onChange={(e) => setOperationDate(e.target.value)} />
          </label>

          <label>
            <div className="text-sm mb-1">Cari</div>
            <select className="border px-3 py-2 w-full disabled:bg-gray-100 disabled:text-gray-500" value={cariId} onChange={(e) => setCariId(e.target.value)} disabled={lockCari}>
              <option value="">Sec...</option>
              {caris.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firm}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="text-sm mb-1">Hesap</div>
            <select className="border px-3 py-2 w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Sec...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode === "payment" && (
          <label>
            <div className="text-sm mb-1">Acik belge</div>
            <select className="border px-3 py-2 w-full disabled:bg-gray-100 disabled:text-gray-500" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} disabled={lockInvoice}>
              <option value="">Sec...</option>
              {openDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.invoiceNo} - Acik: {doc.outstandingAmount.toLocaleString("tr-TR")}
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedDocument ? (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            Belge: <b>{selectedDocument.invoiceNo}</b> | Tutar:{" "}
            <b>{selectedDocument.invoiceAmount.toLocaleString("tr-TR")}</b> | Kapanan:{" "}
            <b>{selectedDocument.settledAmount.toLocaleString("tr-TR")}</b> | Kalan:{" "}
            <b>{selectedDocument.outstandingAmount.toLocaleString("tr-TR")}</b>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label>
            <div className="text-sm mb-1">Yontem</div>
            <select className="border px-3 py-2 w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Nakit</option>
              <option value="bank">Banka</option>
              <option value="kaspi">Kaspi</option>
              <option value="card">Kart</option>
            </select>
          </label>

          <label>
            <div className="text-sm mb-1">Tutar</div>
            <input type="number" className="border px-3 py-2 w-full disabled:bg-gray-100 disabled:text-gray-500" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={lockAmount} />
          </label>

          <label>
            <div className="text-sm mb-1">Fatura No</div>
            <input className="border px-3 py-2 w-full disabled:bg-gray-100 disabled:text-gray-500" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} disabled={lockInvoice} />
          </label>
        </div>

        <label>
          <div className="text-sm mb-1">Aciklama</div>
          <input className="border px-3 py-2 w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Not..." />
        </label>

        <div className="flex justify-end">
          <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-60">
            <Save size={18} />
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}