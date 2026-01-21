// app/register/page.jsx
"use client";

import { useRouter } from "next/navigation";
import { useLang } from "../context/LanguageContext";

export default function RegisterSelectPage() {
  const router = useRouter();
  const { t } = useLang();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            {t("register.title")}
          </h1>
          <p className="text-sm text-slate-500">
            {t("register.subtitle")}
          </p>
        </div>

        <div className="space-y-3">
          {/* 📧 MAIL İLE KAYIT */}
          <button
            onClick={() => router.push("/register-email")}
            className="w-full border border-gray-300 rounded-lg py-3 text-sm text-gray-400 cursor-not-allowed"
            disabled
          >
            {t("register.email_disabled")}
          </button>

          {/* 📱 SMS İLE KAYIT */}
          <button
            onClick={() => router.push("/verify-sms")}
            className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm hover:bg-blue-700 transition"
          >
            {t("register.phone")}
          </button>
        </div>
      </div>
    </div>
  );
}
