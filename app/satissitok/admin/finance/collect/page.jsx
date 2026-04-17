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

function round2(x) {
  return Math.round(num(x) * 100) / 100;
}

function fmtMoney(value) {
  return round2(value).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildAutoAllocations({ totalAmount, selectedIds, openDocuments }) {
  const next = {};
  let remaining = round2(totalAmount);

  for (const invoiceId of selectedIds) {
    const doc = openDocuments.find((row) => row.id === invoiceId);
    if (!doc) continue;

    const assigned = round2(Math.min(remaining, num(doc.outstandingAmount)));
    next[invoiceId] = assigned;
    remaining = round2(remaining - assigned);
  }

  return next;
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
  const [description, setDescription] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState(
    prefillInvoiceId ? [prefillInvoiceId] : []
  );
  const [allocationMap, setAllocationMap] = useState(
    prefillInvoiceId
      ? {
          [prefillInvoiceId]: round2(prefillAmount || 0),
        }
      : {}
  );

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
    if (!prefillCariId && !prefillInvoiceId && !prefillAmount) return;
    setMode(initialMode);
    setCariId(prefillCariId);
    setAmount(prefillAmount || 0);
    if (prefillInvoiceId) {
      setSelectedInvoiceIds([prefillInvoiceId]);
      setAllocationMap({
        [prefillInvoiceId]: round2(prefillAmount || 0),
      });
    }
  }, [initialMode, prefillAmount, prefillCariId, prefillInvoiceId]);

  useEffect(() => {
    const loadOpenDocs = async () => {
      if (!cariId || mode === "advance") {
        setOpenDocuments([]);
        setSelectedInvoiceIds([]);
        setAllocationMap({});
        return;
      }

      const docs = await listOpenDocumentsByCari({ kind: "sale", cariId });
      setOpenDocuments(docs);
    };

    loadOpenDocs();
  }, [cariId, mode]);

  useEffect(() => {
    if (mode === "advance") {
      setSelectedInvoiceIds([]);
      setAllocationMap({});
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "advance") return;

    const validIds = selectedInvoiceIds.filter((invoiceId) =>
      openDocuments.some((doc) => doc.id === invoiceId)
    );

    if (validIds.length !== selectedInvoiceIds.length) {
      setSelectedInvoiceIds(validIds);
    }

    setAllocationMap((prev) => {
      const next = {};
      for (const invoiceId of validIds) {
        const doc = openDocuments.find((row) => row.id === invoiceId);
        if (!doc) continue;
        const currentValue = round2(prev[invoiceId]);
        next[invoiceId] = round2(Math.min(currentValue, num(doc.outstandingAmount)));
      }
      return next;
    });
  }, [mode, openDocuments, selectedInvoiceIds]);

  useEffect(() => {
    if (!prefillInvoiceId || mode === "advance" || openDocuments.length === 0) return;

    const matched = openDocuments.find((doc) => doc.id === prefillInvoiceId);
    if (!matched) return;

    const nextAmount =
      prefillAmount !== "" ? round2(prefillAmount) : round2(matched.outstandingAmount || 0);

    setSelectedInvoiceIds([matched.id]);
    setAllocationMap({ [matched.id]: nextAmount });
    if (!(num(amount) > 0)) {
      setAmount(nextAmount);
    }
  }, [amount, mode, openDocuments, prefillAmount, prefillInvoiceId]);

  useEffect(() => {
    if (!lockAmount || selectedInvoiceIds.length !== 1) return;
    setAllocationMap((prev) => ({
      ...prev,
      [selectedInvoiceIds[0]]: round2(amount),
    }));
  }, [amount, lockAmount, selectedInvoiceIds]);

  const selectedCari = useMemo(() => caris.find((c) => c.id === cariId) || null, [caris, cariId]);
  const selectedDocuments = useMemo(
    () => openDocuments.filter((doc) => selectedInvoiceIds.includes(doc.id)),
    [openDocuments, selectedInvoiceIds]
  );
  const selectedCount = selectedDocuments.length;
  const selectedOutstandingTotal = useMemo(
    () => round2(selectedDocuments.reduce((sum, row) => sum + num(row.outstandingAmount), 0)),
    [selectedDocuments]
  );
  const allocatedTotal = useMemo(
    () =>
      round2(
        selectedDocuments.reduce((sum, row) => sum + num(allocationMap[row.id]), 0)
      ),
    [allocationMap, selectedDocuments]
  );
  const unallocatedAmount = round2(num(amount) - allocatedTotal);

  function toggleInvoice(invoiceId) {
    if (lockInvoice) return;

    setSelectedInvoiceIds((prev) => {
      const exists = prev.includes(invoiceId);
      const nextIds = exists ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId];

      setAllocationMap((current) => {
        if (exists) {
          const next = { ...current };
          delete next[invoiceId];
          return next;
        }

        const next = { ...current };
        const draftAllocations = buildAutoAllocations({
          totalAmount: amount,
          selectedIds: nextIds,
          openDocuments,
        });

        for (const id of nextIds) {
          next[id] = draftAllocations[id] ?? round2(current[id]);
        }

        return next;
      });

      return nextIds;
    });
  }

  function autoDistribute() {
    setAllocationMap(
      buildAutoAllocations({
        totalAmount: amount,
        selectedIds: selectedInvoiceIds,
        openDocuments,
      })
    );
  }

  async function onSave() {
    if (saving) return;

    const amt = round2(amount);
    if (!cariId) return alert("Cari sec");
    if (!(amt > 0)) return alert("Tutar gir");
    if (!accountId) return alert("Hesap sec");

    const settlementLines =
      mode === "advance"
        ? []
        : selectedDocuments
            .map((doc) => ({
              invoiceId: doc.id,
              invoiceNo: doc.invoiceNo || null,
              amount: round2(allocationMap[doc.id]),
              outstandingAmount: round2(doc.outstandingAmount),
            }))
            .filter((row) => row.amount > 0);

    for (const row of settlementLines) {
      if (row.amount - row.outstandingAmount > 0.001) {
        return alert(`Tahsilat tutari acik belgeyi asamaz: ${row.invoiceNo || row.invoiceId}`);
      }
    }

    if (mode !== "advance" && settlementLines.length > 0) {
      const distributed = round2(
        settlementLines.reduce((sum, row) => sum + num(row.amount), 0)
      );

      if (Math.abs(distributed - amt) > 0.001) {
        return alert("Tahsilat tutari ile secili faturalara dagitilan toplam ayni olmali");
      }
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
        invoiceId: settlementLines.length === 1 ? settlementLines[0].invoiceId : null,
        invoiceNo:
          settlementLines.length === 1
            ? settlementLines[0].invoiceNo
            : prefillInvoiceNo.trim() || null,
        invoiceKind: "sale",
        settlementLines: settlementLines.map((row) => ({
          invoiceId: row.invoiceId,
          invoiceNo: row.invoiceNo,
          amount: row.amount,
        })),
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
    <div className="max-w-5xl mx-auto p-6 space-y-6">
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
            <div className="text-sm mb-1">Tahsilat Tutari</div>
            <input type="number" className="border px-3 py-2 w-full disabled:bg-gray-100 disabled:text-gray-500" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={lockAmount} />
          </label>

          <label>
            <div className="text-sm mb-1">Secili Belge</div>
            <input
              className="border px-3 py-2 w-full bg-gray-50 text-gray-700"
              value={
                selectedCount === 0
                  ? mode === "advance"
                    ? "Avans hareketi"
                    : prefillInvoiceNo || "Belge secilmedi"
                  : selectedCount === 1
                  ? selectedDocuments[0]?.invoiceNo || "Tek belge"
                  : `${selectedCount} belge secildi`
              }
              readOnly
            />
          </label>
        </div>

        {mode === "payment" && (
          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Acik Satis Faturalari</div>
                <div className="text-xs text-slate-500">
                  Birden fazla fatura secip tek tahsilati dagitabilirsin.
                </div>
              </div>

              <button
                type="button"
                onClick={autoDistribute}
                disabled={lockInvoice || selectedInvoiceIds.length === 0}
                className="px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700 disabled:opacity-50"
              >
                Tutari Dagit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-bold uppercase text-slate-500">Tahsilat</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{fmtMoney(amount)} KZT</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                <div className="text-[11px] font-bold uppercase text-emerald-700">Dagitilan</div>
                <div className="mt-1 text-lg font-bold text-emerald-800">{fmtMoney(allocatedTotal)} KZT</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                <div className="text-[11px] font-bold uppercase text-amber-700">Kalan Dagitim</div>
                <div className="mt-1 text-lg font-bold text-amber-800">{fmtMoney(unallocatedAmount)} KZT</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-bold uppercase text-slate-500">Secili Acik Tutar</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{fmtMoney(selectedOutstandingTotal)} KZT</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Sec</th>
                    <th className="px-3 py-2 text-left">Fatura</th>
                    <th className="px-3 py-2 text-right">Toplam</th>
                    <th className="px-3 py-2 text-right">Acik</th>
                    <th className="px-3 py-2 text-right">Dagitilacak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {openDocuments.map((doc) => {
                    const checked = selectedInvoiceIds.includes(doc.id);
                    const allocated = round2(allocationMap[doc.id]);

                    return (
                      <tr key={doc.id} className={checked ? "bg-indigo-50/40" : ""}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={lockInvoice && !checked}
                            onChange={() => toggleInvoice(doc.id)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{doc.invoiceNo}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtMoney(doc.invoiceAmount)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-amber-700">{fmtMoney(doc.outstandingAmount)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            value={checked ? allocated : ""}
                            disabled={!checked || (lockInvoice && lockAmount)}
                            onChange={(e) => {
                              const value = round2(e.target.value);
                              setAllocationMap((prev) => ({
                                ...prev,
                                [doc.id]: Math.max(0, Math.min(value, round2(doc.outstandingAmount))),
                              }));
                            }}
                            className="w-32 border px-3 py-1.5 rounded-lg text-right disabled:bg-gray-100"
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {openDocuments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                        Bu cariye ait acik satis faturasi bulunamadi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedDocuments.length > 0 && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                {selectedDocuments.map((doc) => (
                  <div key={doc.id}>
                    {doc.invoiceNo}: Acik {fmtMoney(doc.outstandingAmount)} KZT | Dagitim {fmtMoney(allocationMap[doc.id])} KZT
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
