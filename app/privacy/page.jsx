//app/privacy/page.jsx
"use client";

import { useLang } from "../context/LanguageContext";

export default function PrivacyPage() {
  const { t } = useLang();

  return (
    <main className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">
        {t("privacy.title")}
      </h1>

      <p className="text-sm text-gray-500 mb-8">
        {t("privacy.lastUpdate")}
      </p>

      <section className="space-y-6 text-gray-800 leading-relaxed">
        <p>{t("privacy.intro")}</p>

        <h2 className="text-xl font-semibold">
          {t("privacy.section1.title")}
        </h2>
        <p>{t("privacy.section1.text")}</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>{t("privacy.section1.item1")}</li>
          <li>{t("privacy.section1.item2")}</li>
        </ul>

        <h2 className="text-xl font-semibold">
          {t("privacy.section2.title")}
        </h2>
        <p>{t("privacy.section2.text")}</p>

        <h2 className="text-xl font-semibold">
          {t("privacy.section3.title")}
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>{t("privacy.section3.item1")}</li>
          <li>{t("privacy.section3.item2")}</li>
          <li>{t("privacy.section3.item3")}</li>
        </ul>

        <h2 className="text-xl font-semibold">
          {t("privacy.section4.title")}
        </h2>
        <p>{t("privacy.section4.text")}</p>

        <h2 className="text-xl font-semibold">
          {t("privacy.section5.title")}
        </h2>
        <p>{t("privacy.section5.text")}</p>

        <h2 className="text-xl font-semibold">
          {t("privacy.section6.title")}
        </h2>
        <p>{t("privacy.section6.text")}</p>

        <h2 className="text-xl font-semibold">
          {t("privacy.section7.title")}
        </h2>
        <p>
          Horecalink<br />
          {t("privacy.contactEmail")}:{" "}
          <a
            href="mailto:info@horecalink.kz"
            className="text-blue-600 underline"
          >
            info@horecalink.kz
          </a>
          <br />
          {t("privacy.contactPhone")}:{" "}
          <a
            href="tel:+77004446911"
            className="text-blue-600 underline"
          >
            +7 700 444 69 11
          </a>
        </p>
      </section>
    </main>
  );
}
