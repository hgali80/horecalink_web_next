"use client";

import { Suspense } from "react";
import QuoteRequestClient from "./QuoteRequestClient";
import { useLang } from "../context/LanguageContext";

function Fallback() {
  const { t } = useLang();
  return <div className="p-6">{t("quoteRequest.loading")}</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <QuoteRequestClient />
    </Suspense>
  );
}
