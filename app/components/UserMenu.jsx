"use client";

import Link from "next/link";
import {
  PackageSearch,
} from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useQuoteDraft } from "../hooks/useQuoteDraft";

export default function UserMenu({ mobile = false, onNavigate = () => {} }) {
  const { t } = useLang();
  const { itemKinds } = useQuoteDraft();

  const primaryLinkClass = mobile
    ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d3246] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#243f58]"
    : "inline-flex items-center gap-2 rounded-xl bg-[#1d3246] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#243f58]";

  const wrapperClass = mobile
    ? "flex w-full flex-col items-stretch gap-3"
    : "flex items-center gap-2";

  return (
    <div className={wrapperClass}>
      <Link href="/teklif-talep" onClick={onNavigate} className={primaryLinkClass}>
        <PackageSearch size={18} />
        {t("header.menu.createQuote")}
        {itemKinds > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#ef7d32] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
            {itemKinds}
          </span>
        ) : null}
      </Link>

    </div>
  );
}
