//app/satissitok/admin/layout.jsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAuthorized = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }

    if (!loading && user && !isAuthorized) {
      router.replace("/");
    }
  }, [isAuthorized, loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Bu alan sadece yetkili kullanicilar icindir.</div>
      </div>
    );
  }

  return <>{children}</>;
}
