"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Minus, Plus } from "lucide-react";
import { addToQuoteDraft } from "../services/quoteDraftService";

export default function ProductQuoteActions({ product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const productId = useMemo(() => product?.id || "", [product?.id]);

  const decrement = () => setQuantity((prev) => Math.max(1, prev - 1));
  const increment = () => setQuantity((prev) => prev + 1);

  const handleAddDraft = () => {
    if (!productId) return;
    addToQuoteDraft(productId, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  const handleRequestNow = () => {
    if (!productId) return;
    router.push(`/teklif-talep?product=${encodeURIComponent(productId)}&qty=${quantity}`);
  };

  return (
    <div className="rounded-[24px] bg-white p-4 shadow-[0_20px_50px_rgba(15,35,35,0.08)]">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-2">
        <button
          type="button"
          onClick={decrement}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 transition hover:bg-slate-100"
        >
          <Minus size={18} />
        </button>

        <div className="min-w-[72px] text-center text-lg font-semibold text-slate-900">
          {quantity}
        </div>

        <button
          type="button"
          onClick={increment}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 transition hover:bg-slate-100"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <button
          type="button"
          onClick={handleRequestNow}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <FileText size={18} />
          Teklif iste
        </button>

        <button
          type="button"
          onClick={handleAddDraft}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
        >
          {added ? "Taslağa eklendi" : "Teklif listesine ekle"}
        </button>
      </div>
    </div>
  );
}
