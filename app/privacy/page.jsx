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
        <ul className="list-disc pl-6 space-y-2">
          <li>{t("privacy.section1.name")}</li>
          <li>{t("privacy.section1.phone")}</li>
          <li>{t("privacy.section1.password")}</li>
          <li>{t("privacy.section1.address")}</li>
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
          <li>{t("privacy.section3.item4")}</li>
          <li>{t("privacy.section3.item5")}</li>
        </ul>

        <h2 className="text-xl font-semibold">
          {t("privacy.section4.title")}
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>{t("privacy.section4.logistic")}</li>
          <li>{t("privacy.section4.sms")}</li>
          <li>{t("privacy.section4.legal")}</li>
        </ul>

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
        <ul className="list-disc pl-6 space-y-2">
          <li>{t("privacy.section7.item1")}</li>
          <li>{t("privacy.section7.item2")}</li>
          <li>{t("privacy.section7.item3")}</li>
        </ul>

        <h2 className="text-xl font-semibold">
          {t("privacy.section8.title")}
        </h2>
        <p>{t("privacy.section8.text")}</p>

        <h2 className="text-xl font-semibold">
          {t("privacy.section9.title")}
        </h2>
        <p>
          Horecalink<br />
          {t("privacy.contactEmail")}:{" "}
          <a
            href="mailto:info@horekalink.kz"
            className="text-blue-600 underline"
          >
            info@horekalink.kz
          </a>
        </p>
      </section>
    </main>
  );
}
