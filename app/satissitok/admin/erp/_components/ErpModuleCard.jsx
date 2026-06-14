"use client";

import Link from "next/link";

export default function ErpModuleCard({
  title,
  desc,
  href,
  icon,
  tone = "slate",
  badge = null,
}) {
  const tones = {
    slate: "border-slate-200 text-slate-800 hover:border-slate-400",
    blue: "border-blue-200 text-blue-800 hover:border-blue-400",
    green: "border-emerald-200 text-emerald-800 hover:border-emerald-400",
    orange: "border-orange-200 text-orange-800 hover:border-orange-400",
    purple: "border-violet-200 text-violet-800 hover:border-violet-400",
    red: "border-rose-200 text-rose-800 hover:border-rose-400",
  };

  return (
    <Link
      href={href}
      className={`group flex min-h-[198px] flex-col gap-4 rounded-[26px] border bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tones[tone] || tones.slate}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-current">
          {icon}
        </div>

        {badge ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-xl font-bold tracking-[-0.02em]">{title}</div>
        <p className="text-sm leading-6 text-slate-600">{desc}</p>
      </div>

      <div className="mt-auto text-xs font-bold uppercase tracking-[0.16em] text-slate-400 transition group-hover:text-slate-700">
        Modulu ac
      </div>
    </Link>
  );
}
