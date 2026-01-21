// app/components/TopBar.tsx
"use client";

import { Phone, Mail, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { useLang } from "../context/LanguageContext";

type Lang = "tr" | "ru" | "kz" | "en";

export default function TopBar() {
  const { lang, setLang } = useLang();

  // 🔁 Sayfa açılınca localStorage'dan dili yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hl_lang") as Lang | null;
      if (saved) {
        setLang(saved);
      }
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
      <span className="font-medium tracking-wide">
        Viroo Trade
      </span>

      {/* SAĞ */}
<div className="flex items-center space-x-5">
  {/* WhatsApp + Telefon */}
  <a
    href="https://wa.me/77004446911"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center space-x-1 hover:text-green-400 transition"
  >
    <MessageCircle size={14} />
    <Phone size={13} />
    <span>+7 700 444 6 911</span>
  </a>

  {/* Mail */}
  <span className="flex items-center space-x-1">
    <Mail size={13} />
    <span>info@horecalink.kz</span>
  </span>

  {/* Dil */}
  <select
    value={lang}
    onChange={(e) => changeLanguage(e.target.value as Lang)}
    className="bg-transparent border border-white/40 rounded px-2 py-1 text-white cursor-pointer focus:outline-none"
  >
    <option value="tr" className="bg-[#003366]">TR</option>
    <option value="ru" className="bg-[#003366]">RU</option>
    <option value="kz" className="bg-[#003366]">KZ</option>
    <option value="en" className="bg-[#003366]">EN</option>
  </select>
</div>
    </div>
  );
}
