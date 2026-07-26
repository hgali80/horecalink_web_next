"use client";

import { Mail, Phone } from "lucide-react";

import { useLang } from "../context/LanguageContext";

const SECTIONS = [
  { key: "period", paragraphs: 2 },
  { key: "condition", intro: true, items: 5, outro: true },
  { key: "exchange", paragraphs: 2 },
  { key: "damaged", paragraphs: 2, items: 4, closing: 2 },
  { key: "exceptions", intro: true, items: 5, outro: true },
  { key: "shippingCosts", paragraphs: 3 },
  { key: "refund", paragraphs: 3 },
  { key: "b2b", paragraphs: 2 },
  { key: "application", intro: true, items: 4 },
  { key: "legalRights", paragraphs: 2 },
];

export default function ReturnPolicyPage() {
  const { t } = useLang();

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-sky-700">
            HorecaLink
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("returns.title")}
          </h1>
          <p className="mt-4 text-sm text-slate-500">{t("returns.lastUpdate")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="mb-10 text-base leading-8 text-slate-700">
            {t("returns.intro")}
          </p>

          <div className="space-y-10">
            {SECTIONS.map((section, index) => (
              <PolicySection
                key={section.key}
                index={index + 1}
                section={section}
                t={t}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function PolicySection({ index, section, t }) {
  const baseKey = `returns.sections.${section.key}`;

  return (
    <section className="border-t border-slate-200 pt-8 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-xl font-bold text-[#1d3246]">
        {index}. {t(`${baseKey}.title`)}
      </h2>

      <div className="space-y-4 text-sm leading-7 text-slate-700 sm:text-base">
        {section.intro ? <p>{t(`${baseKey}.intro`)}</p> : null}

        {Array.from({ length: section.paragraphs || 0 }, (_, itemIndex) => (
          <p key={`paragraph-${itemIndex + 1}`}>
            {t(`${baseKey}.paragraph${itemIndex + 1}`)}
          </p>
        ))}

        {section.items ? (
          <ul className="list-disc space-y-2 pl-6 marker:text-sky-700">
            {Array.from({ length: section.items }, (_, itemIndex) => (
              <li key={`item-${itemIndex + 1}`}>
                {t(`${baseKey}.item${itemIndex + 1}`)}
              </li>
            ))}
          </ul>
        ) : null}

        {section.outro ? <p>{t(`${baseKey}.outro`)}</p> : null}

        {Array.from({ length: section.closing || 0 }, (_, itemIndex) => (
          <p key={`closing-${itemIndex + 1}`}>
            {t(`${baseKey}.closing${itemIndex + 1}`)}
          </p>
        ))}

        {section.key === "application" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a
              href="mailto:info@horecalink.kz"
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              <Mail className="h-5 w-5 text-sky-700" />
              info@horecalink.kz
            </a>
            <a
              href="tel:+77004446911"
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              <Phone className="h-5 w-5 text-sky-700" />
              +7 700 444 69 11
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
