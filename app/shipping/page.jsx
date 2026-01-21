//app/shipping/page.jsx
"use client";

import { useLang } from "../context/LanguageContext";

export default function ShippingPage() {
  const { t } = useLang();

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-gray-900">
      {/* Başlık */}
      <section className="bg-white py-16 border-b">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-3xl font-bold mb-4">
            {t("shipping.title")}
          </h1>
          <p className="text-gray-600">
            {t("shipping.subtitle")}
          </p>
        </div>
      </section>

      {/* İçerik */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6 space-y-10">
          <div>
            <h2 className="text-xl font-semibold mb-3">
              {t("shipping.general.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("shipping.general.text")}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">
              {t("shipping.time.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("shipping.time.text")}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">
              {t("shipping.region.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("shipping.region.text")}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">
              {t("shipping.control.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("shipping.control.text")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
