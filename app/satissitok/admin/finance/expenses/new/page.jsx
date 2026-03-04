// app/satissitok/admin/finance/expenses/new/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Home, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { listExpenseCategories, createExpenseCategory } from "@/app/satissitok/services/expenseCategoryService";
import { createExpense } from "@/app/satissitok/services/expenseService";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseNewPage() {
  const router = useRouter();

  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [operationDateISO, setOperationDateISO] = useState(todayISO());
  const [method, setMethod] = useState("cash");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [vatRate, setVatRate] = useState(0);
  const [amountGross, setAmountGross] = useState("");
  const [amountNet, setAmountNet] = useState("");
  const [description, setDescription] = useState("");

  const [working, setWorking] = useState(false);

  async function loadCats() {
    setLoadingCats(true);
    try {
      const list = await listExpenseCategories();
      setCategories(list.filter((x) => x?.active !== false));
    } finally {
      setLoadingCats(false);
    }
  }

  useEffect(() => {
    loadCats();
  }, []);

  const selectedCat = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  useEffect(() => {
    if (selectedCat?.name) setCategoryName(selectedCat.name);
  }, [selectedCat]);

  async function quickAddCategory() {
    const name = prompt("Yeni kategori adı:");
    if (!name) return;
    const id = await createExpenseCategory({ name });
    await loadCats();
    setCategoryId(id);
  }

  async function save() {
    setWorking(true);
    try {
      await createExpense({
        operationDateISO,
        method,
        categoryId: categoryId || null,
        categoryName: categoryName || selectedCat?.name || "",
        vatRate: Number(vatRate) || 0,
        amountNet: amountNet ? Number(amountNet) : 0,
        amountGross: amountGross ? Number(amountGross) : 0,
        description,
      });
      router.push("/satissitok/admin/finance/expenses");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Gider kaydı hatası");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Yeni Gider</h1>
        <div className="text-sm text-gray-600 mt-1">Net kâr raporuna dahil olur.</div>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tarih">
            <input
              type="date"
              className="w-full px-3 py-2 rounded-lg border"
              value={operationDateISO}
              onChange={(e) => setOperationDateISO(e.target.value)}
            />
          </Field>

          <Field label="Ödeme Yöntemi">
            <select
              className="w-full px-3 py-2 rounded-lg border"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="cash">Nakit</option>
              <option value="kaspi">Kaspi</option>
              <option value="bank">Banka</option>
              <option value="other">Diğer</option>
            </select>
          </Field>

          <Field label="Kategori">
            <div className="flex gap-2">
              <select
                className="w-full px-3 py-2 rounded-lg border"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={loadingCats}
              >
                <option value="">(Seç)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={quickAddCategory}
                className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                title="Yeni kategori ekle"
              >
                +
              </button>
            </div>
          </Field>

          <Field label="KDV Oranı (%)">
            <input
              type="number"
              className="w-full px-3 py-2 rounded-lg border"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              min="0"
              step="0.01"
            />
          </Field>

          <Field label="Brüt Tutar (KDV dahil)">
            <input
              type="number"
              className="w-full px-3 py-2 rounded-lg border"
              value={amountGross}
              onChange={(e) => setAmountGross(e.target.value)}
              min="0"
              step="0.01"
              placeholder="örn: 11200"
            />
          </Field>

          <Field label="Net Tutar (KDV hariç)">
            <input
              type="number"
              className="w-full px-3 py-2 rounded-lg border"
              value={amountNet}
              onChange={(e) => setAmountNet(e.target.value)}
              min="0"
              step="0.01"
              placeholder="örn: 10000"
            />
          </Field>
        </div>

        <Field label="Açıklama">
          <textarea
            className="w-full px-3 py-2 rounded-lg border min-h-[90px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="örn: Mart kira ödemesi"
          />
        </Field>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={working}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
          >
            <Save size={18} />
            Kaydet
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        * Net/brüt ikisinden birini girmen yeterli. Sistem KDV oranına göre diğerini hesaplar.
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-1">{label}</div>
      {children}
    </div>
  );
}