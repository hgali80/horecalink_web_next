"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight, House, PackageSearch } from "lucide-react";
import { useLang } from "../../context/LanguageContext";

function SuccessContent() {
  const searchParams = useSearchParams();
  const { t } = useLang();
  const quoteNo = searchParams.get("no") || "";

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f8f9fb] px-4 py-12">
      <section className="w-full max-w-2xl rounded-3xl border border-[#e5e7eb] bg-white px-6 py-12 text-center shadow-[0_24px_60px_rgba(29,50,70,0.10)] md:px-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-11 w-11" aria-hidden="true" />
        </div>

        <p className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-700">
          {t("quoteSuccess.eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#1d3246] md:text-4xl">
          {t("quoteSuccess.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 md:text-base">
          {t("quoteSuccess.description")}
        </p>

        {quoteNo ? (
          <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-[#f2f4f6] px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {t("quoteSuccess.requestNo")}
            </div>
            <div className="mt-1 text-lg font-extrabold text-[#1d3246]">{quoteNo}</div>
          </div>
        ) : null}

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/catalog" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d3246] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#243f58]">
            <PackageSearch className="h-4 w-4" />
            {t("quoteSuccess.catalog")}
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd5e1] bg-white px-6 py-3.5 text-sm font-bold text-[#1d3246] transition hover:bg-slate-50">
            <House className="h-4 w-4" />
            {t("quoteSuccess.home")}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function QuoteSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] bg-[#f8f9fb]" />}>
      <SuccessContent />
    </Suspense>
  );
}
