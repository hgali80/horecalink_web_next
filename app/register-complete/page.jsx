//app/register-complete/page.jsx
"use client";

import { useEffect, useState } from "react";
import { getAuth, updateProfile, linkWithCredential, EmailAuthProvider } from "firebase/auth";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";
import { app } from "../../firebase";

export default function RegisterCompletePage() {
  const auth = getAuth(app);
  const db = getFirestore(app);

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
  const unsub = auth.onAuthStateChanged((user) => {
    if (!user) {
      // ❗ HEMEN redirect ETMİYORUZ
      // çünkü bu sayfa auth geçiş sayfası
      return;
    }

    // phone_xxx UID'den telefonu çıkarıyoruz
    if (user.uid.startsWith("phone_")) {
      const digits = user.uid.replace("phone_", "");
      setPhone("+7" + digits.slice(-10));
    }
  });

  return () => unsub();
}, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (!fullName || password.length < 6 || password !== password2) {
      setMsg("Bilgileri eksiksiz ve doğru giriniz.");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Oturum bulunamadı.");

      const fakeEmail = `${phone}@temporary.com`;
      const credential = EmailAuthProvider.credential(fakeEmail, password);

      // 🔐 Email + Password bağla
      await linkWithCredential(user, credential);

      // 👤 Auth profile
      await updateProfile(user, { displayName: fullName });

      // 📄 Firestore user kaydı (mobil ile AYNI)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        phoneNumber: phone,
        email: fakeEmail,
        isFakeEmail: true,
        createdAt: Timestamp.now(),
      });

      window.location.href = "/";
    } catch (err) {
      setMsg(err.message || "Kayıt tamamlanamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 space-y-6">
        <h1 className="text-xl font-semibold text-center">
          Kaydı Tamamla
        </h1>

        {msg && <p className="text-center text-sm text-red-600">{msg}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ad Soyad"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />

          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Şirket Adı (opsiyonel)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <input
            value={phone}
            disabled
            className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-100"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />

          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Şifre (tekrar)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white py-2.5 rounded-lg"
          >
            {loading ? "Kaydediliyor..." : "Kaydı Tamamla"}
          </button>
        </form>
      </div>
    </div>
  );
}
