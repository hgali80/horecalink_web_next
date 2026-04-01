//app/not-found.jsx
"use client";

import Link from "next/link";
import { useLang } from "./context/LanguageContext";

export default function NotFoundPage() {
  const { t } = useLang();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-center shadow-md">
        <h1 className="text-2xl font-semibold text-gray-800">{t("notFound.title")}</h1>

        <p className="text-sm text-gray-600">{t("notFound.text")}</p>

        <div className="flex justify-center gap-3 pt-4">
          <Link href="/" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
            {t("notFound.goHome")}
          </Link>

          <button
            onClick={() => window.history.back()}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
          >
            {t("notFound.goBack")}
          </button>
        </div>
      </div>
    </main>
  );
}
