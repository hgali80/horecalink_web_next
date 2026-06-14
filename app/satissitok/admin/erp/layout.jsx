"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Home } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

export default function ErpLayout({ children }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAuthorized = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }

    if (!loading && user && !isAuthorized) {
      router.replace("/satissitok/admin");
    }
  }, [isAuthorized, loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Yukleniyor...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">ERP modulu sadece login olan yetkili kullanicilar icindir.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/satissitok/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Admin Panele Don
          </Link>

          <Link
            href="/satissitok/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Home size={16} />
            Ana Sayfa
          </Link>

          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <Boxes size={16} />
            ERP Modulu
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
