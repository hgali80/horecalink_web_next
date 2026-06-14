"use client";

export default function ErpSectionHeader({ eyebrow, title, description }) {
  return (
    <div className="space-y-3">
      {eyebrow ? (
        <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
          {eyebrow}
        </div>
      ) : null}
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
    </div>
  );
}
