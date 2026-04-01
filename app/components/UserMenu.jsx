"use client";
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  PackageSearch,
  ReceiptText,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";

export default function UserMenu({ mobile = false, onNavigate = () => {} }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useLang();

  const baseLinkClass = mobile
    ? "inline-flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    : "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100";

  const primaryLinkClass = mobile
    ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d3246] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#243f58]"
    : "inline-flex items-center gap-2 rounded-xl bg-[#1d3246] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#243f58]";

  const dangerButtonClass = mobile
    ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700"
    : "inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700";

  const wrapperClass = mobile
    ? "flex w-full flex-col items-stretch gap-3"
    : "flex items-center gap-2";

  const handleLogout = async () => {
    await logout();
    onNavigate();
    router.push("/");
  };

  return (
    <div className={wrapperClass}>
      <Link href="/teklifler" onClick={onNavigate} className={baseLinkClass}>
        <ReceiptText size={18} />
        {t("header.menu.quotes")}
      </Link>

      <Link href="/teklif-talep" onClick={onNavigate} className={primaryLinkClass}>
        <PackageSearch size={18} />
        {t("header.menu.createQuote")}
      </Link>

      {user?.role === "admin" ? (
        <Link href="/satissitok/admin" onClick={onNavigate} className={baseLinkClass}>
          <LayoutDashboard size={18} />
          {t("header.menu.adminPanel")}
        </Link>
      ) : null}

      {user ? (
        <button type="button" onClick={handleLogout} className={dangerButtonClass}>
          <LogOut size={18} />
          {t("header.menu.logout")}
        </button>
      ) : null}
    </div>
  );
}