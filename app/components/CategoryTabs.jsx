// app/components/CategoryTabs.jsx
// app/components/CategoryTabs.jsx
"use client";

import React from "react";
import { useLang } from "../context/LanguageContext";
import { getGroupLabel } from "../lib/catalog/catalogLabels";

const GROUPS = [
  { key: "institutional", fallback: "Temizlik & Hijyen" },
  { key: "equipment", fallback: "Mutfak Ekipmanları" },
  { key: "stainless", fallback: "Paslanmaz Ekipmanlar" },
  { key: "accessories", fallback: "Aksesuar" },
];

export default function CategoryTabs({ selectedGroup, onSelectGroup }) {
  const { t, lang } = useLang();

  return (
    <div className="w-full bg-white border-b flex justify-center flex-wrap gap-3 py-4">
      {GROUPS.map((group) => (
        <button
          key={group.key}
          onClick={() => onSelectGroup(group.key)}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            selectedGroup === group.key
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {getGroupLabel({ t, lang, groupKey: group.key, fallback: group.fallback })}
        </button>
      ))}
    </div>
  );
}
