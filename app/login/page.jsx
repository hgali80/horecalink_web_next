//app/login/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/index";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/satissitok/admin");
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "").trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/satissitok/admin");
    } catch (err) {
      console.error("Login error:", err);

      let errorText = "login.genericError";

      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential" ||
        err.code === "auth/invalid-login-credentials"
      ) {
        errorText = "login.invalidCredentials";
      } else if (err.code === "auth/invalid-email") {
        errorText = "login.invalidEmail";
      } else if (err.code === "auth/too-many-requests") {
        errorText =
          "login.tooManyRequests";
      }

      setMsg(errorText);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-md sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            {t("login.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("login.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {msg ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(msg)}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("login.emailLabel")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t("login.emailPlaceholder")}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-sky-600"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("login.passwordLabel")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder={t("login.passwordPlaceholder")}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-sky-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-start">
          <Link
            href="/forgot-password"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            {t("login.forgotPassword")}
          </Link>
        </div>
      </div>
    </div>
  );
}