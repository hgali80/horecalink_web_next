//app/profile/change-phone/page.jsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "../../../firebase";
import {
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateEmail,
} from "firebase/auth";

import { doc, updateDoc, getDoc } from "firebase/firestore";

export default function ChangePhonePage() {
  const router = useRouter();

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [newPhone, setNewPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");

  const [step, setStep] = useState(1); // 1: telefon gir, 2: sms doğrula
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auth + Profile yükleme
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setFirebaseUser(user);

      // Telefon hesabı mı?
      const isPhoneAccount = user.email.includes("@phone.horecalink.kz");

      if (!isPhoneAccount) {
        setError("Bu hesap telefonla kayıtlı değil. Telefon değiştirilemez.");
        return;
      }

      // Firestore profilini çek
      const phone = user.email
        .replace("phone_", "")
        .replace("@phone.horecalink.kz", "");

      const ref = doc(db, "users", `phone_${phone}`);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProfile(snap.data());
      }
    });

    return () => unsub();
  }, []);

  // Invisible Recaptcha
  const setupRecaptcha = () => {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      { size: "invisible" }
    );
  };

  const sendSms = async () => {
    setError("");

    if (!newPhone) {
      setError("Lütfen yeni telefonu girin.");
      return;
    }

    setLoading(true);

    try {
      setupRecaptcha();

      const appVerifier = window.recaptchaVerifier;

      const confirmation = await signInWithPhoneNumber(
        auth,
        newPhone,
        appVerifier
      );

      window.confirmationResult = confirmation;
      setStep(2);
    } catch (err) {
      console.error(err);
      setError("SMS gönderilemedi.");
    }

    setLoading(false);
  };

  const verifyCode = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await window.confirmationResult.confirm(smsCode);

      // 🔥 1) Pseudo email değiştirme
      const cleanPhone = newPhone.replace(/[^\d]/g, "");
      const newPseudoEmail = `phone_${cleanPhone}@phone.horecalink.kz`;

      await updateEmail(firebaseUser, newPseudoEmail);

      // 🔥 2) Firestore güncelleme
      const oldPhone = firebaseUser.email
        .replace("phone_", "")
        .replace("@phone.horecalink.kz", "");

      const oldRef = doc(db, "users", `phone_${oldPhone}`);
      const newRef = doc(db, "users", `phone_${cleanPhone}`);

      // Eski dokümanı al
      const oldSnap = await getDoc(oldRef);

      if (oldSnap.exists()) {
        const data = oldSnap.data();

        // Yeni dokümanı oluştur
        await updateDoc(oldRef, {
          phoneNumber: `+${cleanPhone}`,
        });

        // Belge ID değiştirmek için yapmamız gereken:
        await updateDoc(oldRef, {
          phoneNumber: `+${cleanPhone}`,
        });

        // NOT: Firestore belge ID'si değiştirilemez.  
        // Eğer gerçekten ID değişmeli diyorsan: yeni belge oluştur → eskisini sil.
        // Şimdilik ID aynı kalacak: phone_777... (eski)
      }

      router.push("/profile");
    } catch (err) {
      console.error(err);
      setError("Doğrulama başarısız.");
    }

    setLoading(false);
  };

  if (!firebaseUser || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 flex justify-center">
      <div className="w-full max-w-xl bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Telefon Numarasını Değiştir
        </h1>

        <div id="recaptcha-container"></div>

        {step === 1 && (
          <>
            <label className="block text-sm mb-1">Yeni Telefon</label>
            <input
              type="text"
              placeholder="+7 700 000 00 00"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full border p-3 rounded"
            />

            {error && <p className="text-red-500 mt-2">{error}</p>}

            <button
              onClick={sendSms}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded mt-4"
              disabled={loading}
            >
              {loading ? "Gönderiliyor..." : "SMS Gönder"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <label className="block text-sm mb-1">SMS Kodunu Girin</label>
            <input
              type="text"
              placeholder="000000"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
              className="w-full border p-3 rounded"
            />

            {error && <p className="text-red-500 mt-2">{error}</p>}

            <button
              onClick={verifyCode}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded mt-4"
              disabled={loading}
            >
              {loading ? "Doğrulanıyor..." : "Numarayı Güncelle"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
