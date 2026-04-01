// app/components/UserMenu.jsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function UserMenu({ mobile = false }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (!user) {
    return null;
  }

  return (
    <div
      className={`flex items-center ${
        mobile ? "flex-col items-start gap-3" : "gap-4"
      } text-sm`}
    >
      <Link
        href="/satissitok/admin"
        className="text-gray-700 transition hover:text-blue-600"
      >
        Yönetim Paneli
      </Link>

      <Link
        href="/teklif-talep"
        className="rounded-md bg-blue-700 px-3 py-1 text-white transition hover:bg-blue-800"
      >
        Teklif Al
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="rounded-md bg-red-600 px-3 py-1 text-white transition hover:bg-red-700"
      >
        Çıkış Yap
      </button>
    </div>
  );
}