//app/forgot-password/page.jsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase";

export default function ForgotPasswordPage() {
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
        setError("Lütfen email girin.");
        setSending(false);
        return;
      }

      // Telefon ile kayıt olan kullanıcılar için kontrol
      if (email.includes("@phone.horecalink.kz")) {
        setError("Bu hesap telefonla kayıtlı. Şifre sıfırlama emaili gönderilemez.");
        setSending(false);
        return;
      }

      await sendPasswordResetEmail(auth, email);

      setMessage("Şifre sıfırlama bağlantısı email adresine gönderildi.");
    } catch (err) {
      console.error(err);
      setError("Email bulunamadı veya gönderilemedi.");
    }

    setSending(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center items-center px-4">
      <div className="w-full max-w-md bg-white shadow rounded-lg p-6">

        <h1 className="text-xl font-semibold mb-6 text-center">
          Şifre Sıfırlama
        </h1>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              placeholder="mail@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-3 rounded"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}

          <button
            type="submit"
            disabled={sending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded"
          >
            {sending ? "Gönderiliyor..." : "Email Gönder"}
          </button>
        </form>

        <button
          onClick={() => router.push("/login")}
          className="mt-4 w-full text-center text-gray-700 hover:underline"
        >
          Giriş Sayfasına Dön
        </button>

      </div>
    </main>
  );
}
