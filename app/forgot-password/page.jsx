//app/forgot-password/page.jsx

"use client";

import { useLang } from "../context/LanguageContext";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase";

export default function ForgotPasswordPage() {
  const { t } = useLang();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    setMessage("");

    try {
      if (!email) {
        setError("forgotPassword.emptyEmail");
        setSending(false);
        return;
      }

      // Telefon ile kayıt olan kullanıcılar için kontrol
      if (email.includes("@phone.horecalink.kz")) {
        setError("forgotPassword.phoneAccount");
        setSending(false);
        return;
      }

      await sendPasswordResetEmail(auth, email);

      setMessage("forgotPassword.success");
    } catch (err) {
      console.error(err);
      setError("forgotPassword.error");
    }

    setSending(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center items-center px-4">
      <div className="w-full max-w-md bg-white shadow rounded-lg p-6">

        <h1 className="text-xl font-semibold mb-6 text-center">
          {t("forgotPassword.title")}
        </h1>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">{t("login.emailLabel")}</label>
            <input
              type="email"
              placeholder="mail@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-3 rounded"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{t(error)}</p>}
          {message && <p className="text-green-600 text-sm">{t(message)}</p>}

          <button
            type="submit"
            disabled={sending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded"
          >
            {sending ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
          </button>
        </form>

        <button
          onClick={() => router.push("/login")}
          className="mt-4 w-full text-center text-gray-700 hover:underline"
        >
          {t("forgotPassword.backToLogin")}
        </button>

      </div>
    </main>
  );
}
