// app/components/TopBar.tsx
"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { useLang } from "../context/LanguageContext";

type Lang = "tr" | "ru" | "kz" | "en";

export default function TopBar() {
  const { lang, setLang } = useLang();

  return (
    <div className="flex items-center justify-between border-b border-blue-900/40 bg-gradient-to-r from-[#002855] to-[#003366] px-4 py-1 text-xs text-white">
      <span className="font-medium tracking-wide">Viroo Trade</span>

      <div className="flex items-center space-x-5">
        <a
          href="https://wa.me/77004446911"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 transition hover:text-green-400"
        >
          <MessageCircle size={14} />
          <Phone size={13} />
          <span>+7 700 444 6 911</span>
        </a>

        <span className="flex items-center space-x-1">
          <Mail size={13} />
          <span>info@horecalink.kz</span>
        </span>

        <select
          value={lang}
          onChange={(event) => setLang(event.target.value as Lang)}
          className="cursor-pointer rounded border border-white/40 bg-transparent px-2 py-1 text-white focus:outline-none"
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
      </div>
    </div>
  );
}
