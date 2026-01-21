// app/components/UserMenu.jsx
"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";

export default function UserMenu({ mobile = false }) {
  const { user, logout } = useAuth();
  const { t } = useLang();

  // 🔹 Giriş yapılmamışsa
  if (!user) {
    return (
      <div
        className={`flex items-center ${
          mobile ? "flex-col items-start gap-3" : "space-x-4"
        } text-sm`}
      >
        {/* LOGIN */}
        <Link
          href="/login"
          className="text-gray-700 hover:text-blue-600 transition"
        >
          {t("usermenu.login")}
        </Link>

        {/* REGISTER */}
        <Link
          href="/register"
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          {t("usermenu.register")}
        </Link>
      </div>
    );
  }

  // 🔹 Giriş yapılmışsa
  return (
    <div
      className={`flex items-center ${
        mobile ? "flex-col items-start gap-3" : "space-x-4"
      } text-sm`}
    >
      <Link
        href="/profile"
        className="text-gray-700 hover:text-blue-600 transition"
      >
        {t("usermenu.profile")}
      </Link>

      <button
        onClick={logout}
        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
      >
        {t("usermenu.logout")}
      </button>
    </div>
  );
}
