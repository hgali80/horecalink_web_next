"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Minus, Plus } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useQuoteDraft } from "../hooks/useQuoteDraft";
import {
  addToQuoteDraft,
  removeFromQuoteDraft,
  updateQuoteDraftItem,
} from "../services/quoteDraftService";

export default function ProductQuoteActions({
  product,
  variant = "default",
  showRequestButton = false,
}) {
  const router = useRouter();
  const { t } = useLang();
  const { items } = useQuoteDraft();

  const productId = useMemo(() => product?.id || "", [product?.id]);
  const currentQuantity = useMemo(() => {
    const matchedItem = items.find((item) => item.productId === productId);
    return Number(matchedItem?.quantity) || 0;
  }, [items, productId]);

  const isCompact = variant === "compact";

  const handleAddDraft = () => {
    if (!productId) return;
    addToQuoteDraft(productId, 1);
  };

  const handleIncrement = () => {
    if (!productId) return;
    addToQuoteDraft(productId, 1);
  };

  const handleDecrement = () => {
    if (!productId) return;

    if (currentQuantity <= 1) {
      removeFromQuoteDraft(productId);
      return;
    }

    updateQuoteDraftItem(productId, currentQuantity - 1);
  };

  const handleOpenQuoteList = () => {
    router.push("/teklif-talep");
  };

  if (!productId) return null;

  return (
    <div
      className={
        isCompact
          ? "flex flex-col gap-2"
          : "rounded-[24px] bg-white p-4 shadow-[0_20px_50px_rgba(15,35,35,0.08)]"
      }
    >
      {currentQuantity > 0 ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl ${
            isCompact ? "bg-[#eef2f5] px-2 py-2" : "bg-slate-50 p-2"
          }`}
        >
          <button
            type="button"
            onClick={handleDecrement}
            aria-label={t("quoteDraft.decrease")}
            className={`flex items-center justify-center rounded-2xl bg-white text-slate-700 transition hover:bg-slate-100 ${
              isCompact ? "h-10 w-10" : "h-11 w-11"
            }`}
          >
            <Minus size={18} />
          </button>

          <div className="flex min-w-[96px] flex-col items-center justify-center text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              {t("quoteDraft.add")}
            </span>
            <span className={`${isCompact ? "text-base" : "text-lg"} font-semibold text-slate-900`}>
              {currentQuantity}
            </span>
          </div>

          <button
            type="button"
            onClick={handleIncrement}
            aria-label={t("quoteDraft.increase")}
            className={`flex items-center justify-center rounded-2xl bg-white text-slate-700 transition hover:bg-slate-100 ${
              isCompact ? "h-10 w-10" : "h-11 w-11"
            }`}
          >
            <Plus size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAddDraft}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1d3246] text-white transition hover:bg-[#243f58] ${
            isCompact
              ? "px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em]"
              : "px-5 py-3 text-sm font-semibold"
          }`}
        >
          <FileText size={18} />
          {t("quoteDraft.add")}
        </button>
      )}

      {showRequestButton ? (
        <button
          type="button"
          onClick={handleOpenQuoteList}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
        >
          <FileText size={18} />
          {t("header.menu.quotes")}
        </button>
      ) : null}
    </div>
  );
}
