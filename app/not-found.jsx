//app/not-found.jsx
"use client";

import Link from "next/link";
import { useLang } from "./context/LanguageContext";
import { getT } from "./lib/i18n";

export default function NotFoundPage() {
  const { lang } = useLang();
  const t = getT(lang);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-6 text-center space-y-4">
        
        <h1 className="text-2xl font-semibold text-gray-800">
          {t("notFound.title")}
        </h1>

        <p className="text-gray-600 text-sm">
          {t("notFound.text")}
        </p>

        <div className="flex justify-center gap-3 pt-4">
          <Link
            href="/"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            {t("notFound.goHome")}
          </Link>

          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
          >
            {t("notFound.goBack")}
          </button>
        </div>
      </div>
    </main>
  );
}

