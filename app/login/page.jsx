//app/login/page.jsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/index";

export default function LoginPage() {
  const [method, setMethod] = useState("email");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Horecalink’e Giriş Yap
          </h1>
          <p className="text-sm text-slate-500">
            Kayıt olurken hangi yöntemi kullandıysan onunla giriş yap.
          </p>
        </div>

        {/* Yöntem seçimi */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-sm">
          <button
            type="button"
            onClick={() => setMethod("email")}
            className={`py-2 rounded-lg font-medium transition ${
              method === "email"
                ? "bg-white shadow text-slate-900"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            E-posta ile giriş
          </button>
          <button
            type="button"
            onClick={() => setMethod("phone")}
            className={`py-2 rounded-lg font-medium transition ${
              method === "phone"
                ? "bg-white shadow text-slate-900"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Telefon ile giriş
          </button>
        </div>

        {method === "email" ? <EmailLoginForm /> : <PhoneLoginForm />}

        <div className="flex items-center justify-between text-sm">
          <Link
            href="/forgot-password"
            className="text-slate-500 hover:text-slate-900"
          >
            Şifremi unuttum
          </Link>
          <Link
            href="/register"
            className="font-semibold text-sky-600 hover:text-sky-700"
          >
            Hesabın yok mu? Kayıt ol
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmailLoginForm() {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const email = e.target.email.value.trim();
    const password = e.target.password.value.trim();

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        await auth.signOut();
        setMsg(
          "E-posta adresiniz henüz doğrulanmamış. Lütfen posta kutunuzu kontrol edin."
        );
        setLoading(false);
        return;
      }

      setMsg("Giriş başarılı! Yönlendiriliyorsunuz...");
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err) {
      console.error("Email login error:", err);
      let text = "Giriş başarısız. Bilgilerinizi kontrol edin.";

      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        text = "E-posta veya şifre hatalı.";
      } else if (err.code === "auth/too-many-requests") {
        text =
          "Çok fazla deneme yaptınız. Hesabınız geçici olarak kilitlendi, lütfen daha sonra tekrar deneyin.";
      }

      setMsg(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {msg && <p className="text-center text-red-500 text-sm">{msg}</p>}

      <div className="space-y-1">
        <label className="text-sm font-medium">E-posta</label>
        <input
          name="email"
          type="email"
          required
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Şifre</label>
        <input
          name="password"
          type="password"
          required
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-sky-600 text-white py-2.5 rounded-lg"
      >
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
    </form>
  );
}

function PhoneLoginForm() {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const rawPhone = e.target.phone.value.trim();
    const password = e.target.password.value.trim();

    // 1) Kullanıcının girdiği: 10 haneli numara (ör: 7004446911)
    let digits = rawPhone.replace(/\D/g, "");

    if (digits.length !== 10) {
      setMsg("Telefon numarası 10 haneli olmalıdır.");
      setLoading(false);
      return;
    }

    // 2) Login için +7 formatı → 77004446911
    digits = "7" + digits;

    // 3) Fake email login formatı
    const fakeEmail = `+${digits}@temporary.com`;

    try {
      await signInWithEmailAndPassword(auth, fakeEmail, password);

      setMsg("Giriş başarılı! Yönlendiriliyorsunuz...");
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err) {
      console.error("Phone login error:", err);
      let text = "Giriş başarısız. Bilgilerinizi kontrol edin.";

      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        text = "Telefon numarası veya şifre hatalı.";
      } else if (err.code === "auth/too-many-requests") {
        text =
          "Çok fazla deneme yaptınız. Hesabınız geçici olarak kilitlendi, lütfen daha sonra tekrar deneyin.";
      }

      setMsg(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {msg && <p className="text-center text-red-500 text-sm">{msg}</p>}

      <div className="space-y-1">
        <label className="text-sm font-medium">Telefon</label>
        <div className="flex gap-2">
          <span className="bg-slate-50 border px-2 rounded-lg">+7</span>
          <input
            name="phone"
            type="tel"
            required
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            placeholder="702 000 00 00"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Şifre</label>
        <input
          name="password"
          type="password"
          required
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-sky-600 text-white py-2.5 rounded-lg"
      >
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
    </form>
  );
}
