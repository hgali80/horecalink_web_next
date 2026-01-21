//app/verify-sms/page.jsx
"use client";

import { useState } from "react";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "../../firebase";

export default function VerifySmsPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [msg, setMsg] = useState(null);

  const auth = getAuth(app);
  const functions = getFunctions(app, "us-central1");
  const db = getFirestore(app);

  const digits = phone.replace(/\D/g, "");
  const fullPhone = "+7" + digits;

  // ⏱️ basit countdown
  const startCountdown = () => {
    setSeconds(60);
    const i = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(i);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  // 📩 SMS KODU TALEBİ
  const requestCode = async () => {
    setMsg(null);

    if (digits.length !== 10) {
      setMsg("Telefon numarası 10 haneli olmalıdır.");
      return;
    }

    try {
      await addDoc(collection(db, "sms_requests"), {
        phone: fullPhone,
        status: "request",
        type: "register",
        createdAt: serverTimestamp(),
      });

      setMsg("SMS kodu talep edildi.");
      startCountdown();
    } catch (err) {
      setMsg("SMS talebi oluşturulamadı.");
    }
  };

  // 🔐 KOD DOĞRULAMA
  const handleVerify = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (digits.length !== 10 || !code) {
      setMsg("Telefon veya kod eksik.");
      return;
    }

    setLoading(true);
    try {
      const verifyCode = httpsCallable(functions, "verifyCode");
      const res = await verifyCode({
        phone: fullPhone,
        code: code.trim(),
      });

      if (res.data?.verified && res.data?.customToken) {
  // 🔐 Firebase Auth login (SMS doğrulama)
  await signInWithCustomToken(auth, res.data.customToken);

  // 👉 KAYDI TAMAMLAMA SAYFASINA GİT
  window.location.href = "/register-complete";
} else {
  setMsg("Kod doğrulanamadı.");
}

    } catch (err) {
      setMsg(err.message || "Doğrulama hatası.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold">SMS Doğrulama</h1>
          <p className="text-sm text-slate-500">
            Telefonuna gelen kodu gir
          </p>
        </div>

        {msg && <p className="text-center text-sm text-red-600">{msg}</p>}

        <div>
          <label className="text-sm font-medium">Telefon</label>
          <div className="flex gap-2">
            <span className="px-3 py-2 border rounded-lg bg-slate-50">+7</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              maxLength={10}
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={requestCode}
          disabled={seconds > 0}
          className="w-full border rounded-lg py-2 text-sm"
        >
          {seconds > 0
            ? `Tekrar gönder (${seconds})`
            : "SMS Kodu Al"}
        </button>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="text-sm font-medium">SMS Kodu</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white py-2.5 rounded-lg"
          >
            {loading ? "Doğrulanıyor..." : "Doğrula ve Devam Et"}
          </button>
        </form>
      </div>
    </div>
  );
}

