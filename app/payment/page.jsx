//app/payment/page.jsx

"use client";

import { useLang } from "../context/LanguageContext";

export default function PaymentPage() {
  const { t } = useLang();

  return (
    <main className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">
        {t("payment.title")}
      </h1>

      <p className="text-sm text-gray-500 mb-8">
        {t("payment.lastUpdate")}
      </p>

      <section className="space-y-6 text-gray-800 leading-relaxed">
        <p>{t("payment.intro")}</p>

        <h2 className="text-xl font-semibold">
          {t("payment.section1.title")}
        </h2>
        <p>{t("payment.section1.text")}</p>

        <h2 className="text-xl font-semibold">
          {t("payment.section2.title")}
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>{t("payment.section2.item1")}</li>
          <li>{t("payment.section2.item2")}</li>
        </ul>

        <h2 className="text-xl font-semibold">
          {t("payment.section3.title")}
        </h2>
        <p>{t("payment.section3.text")}</p>
      </section>
    </main>
  );
}
