// app/components/CategoryTabs.jsx
"use client";

import React from "react";
import { useLang } from "../context/LanguageContext";

export default function CategoryTabs({ selectedGroup, onSelectGroup }) {
  const { t } = useLang();

  const groups = [
    { key: "kurumsal", label: t("categoryTabs.kurumsal") },
    { key: "yatirim", label: t("categoryTabs.yatirim") },
    { key: "paslanmaz", label: t("categoryTabs.paslanmaz") },
    { key: "temizlik", label: t("categoryTabs.temizlik") },
    { key: "ambalaj", label: t("categoryTabs.ambalaj") },
  ];

  return (
    <div className="w-full bg-white border-b flex justify-center flex-wrap gap-3 py-4">
      {groups.map((group) => (
        <button
          key={group.key}
          onClick={() => onSelectGroup(group.key)}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            selectedGroup === group.key
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}
