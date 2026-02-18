// app/components/TopBar.tsx
// app/components/TopBar.tsx
"use client";

import Link from "next/link";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

type Lang = "tr" | "ru" | "kz" | "en";

export default function TopBar() {
  const { lang, setLang, t } = useLang();
  const { user, logout } = useAuth();

  // 🔁 Sayfa açılınca localStorage'dan dili yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hl_lang") as Lang | null;
      if (saved) setLang(saved);
    } catch {}
  }, [setLang]);

  const changeLanguage = (next: Lang) => {
    setLang(next); // ✅ TEK KAYNAK
    try {
      localStorage.setItem("hl_lang", next);
    } catch {}
  };

  return (
    <div className="w-full bg-gradient-to-r from-[#002855] to-[#003366] text-white text-xs py-1 px-4 flex justify-between items-center border-b border-blue-900/40">
      {/* SOL */}
      <span className="font-medium tracking-wide">Viroo Trade</span>

      {/* SAĞ */}
      <div className="flex items-center gap-4">
        {/* WhatsApp + Telefon */}
        <a
          href="https://wa.me/77004446911"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 hover:text-green-400 transition"
        >
          <MessageCircle size={14} />
          <Phone size={13} />
          <span>+7 700 444 6 911</span>
        </a>

        {/* Mail */}
        <span className="hidden md:flex items-center gap-1">
          <Mail size={13} />
          <span>info@horecalink.kz</span>
        </span>

        {/* Dil */}
        <select
          value={lang}
          onChange={(e) => changeLanguage(e.target.value as Lang)}
          className="bg-transparent border border-white/40 rounded px-2 py-1 text-white cursor-pointer focus:outline-none"
        >
          <option value="tr" className="bg-[#003366]">
            TR
          </option>
          <option value="ru" className="bg-[#003366]">
            RU
          </option>
          <option value="kz" className="bg-[#003366]">
            KZ
          </option>
          <option value="en" className="bg-[#003366]">
            EN
          </option>
        </select>

        {/* AUTH (TopBar'a taşındı) */}
        {!user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-2 py-1 rounded border border-white/30 hover:bg-white/10 transition font-semibold"
            >
              {t("usermenu.login")}
            </Link>
            <Link
              href="/register"
              className="px-2 py-1 rounded bg-amber-500 text-[#003366] hover:bg-amber-400 transition font-bold"
            >
              {t("usermenu.register")}
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="px-2 py-1 rounded border border-white/30 hover:bg-white/10 transition font-semibold"
            >
              {t("usermenu.profile")}
            </Link>
            <button
              onClick={logout}
              className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 transition font-bold"
            >
              {t("usermenu.logout")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
