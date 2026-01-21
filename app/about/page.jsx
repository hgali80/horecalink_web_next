// app/about/page.jsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "../context/LanguageContext";
import {
  CheckCircle,
  Users,
  Award,
  TrendingUp,
  Shield,
  Globe,
  Truck,
  Package,
  Wrench,
} from "lucide-react";

export default function AboutPage() {
  const { t } = useLang();

  const values = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: t("values.integrity.title"),
      description: t("values.integrity.description"),
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: t("values.innovation.title"),
      description: t("values.innovation.description"),
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: t("values.customer.title"),
      description: t("values.customer.description"),
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: t("values.excellence.title"),
      description: t("values.excellence.description"),
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: t("values.sustainability.title"),
      description: t("values.sustainability.description"),
    },
  ];

  const milestones = [
    { year: t("milestones.step1.title"), event: t("milestones.step1.event") },
    { year: t("milestones.step2.title"), event: t("milestones.step2.event") },
    { year: t("milestones.step3.title"), event: t("milestones.step3.event") },
    { year: t("milestones.step4.title"), event: t("milestones.step4.event") },
  ];

  const operations = [
    {
      icon: <Package className="w-6 h-6" />,
      title: t("operations.items.stock.title"),
      text: t("operations.items.stock.text"),
      image: "/images/operations/stock.jpg",
      alt: t("operations.items.stock.alt"),
    },
    {
      icon: <Truck className="w-6 h-6" />,
      title: t("operations.items.logistics.title"),
      text: t("operations.items.logistics.text"),
      image: "/images/operations/logistics.jpg",
      alt: t("operations.items.logistics.alt"),
    },
    {
      icon: <Wrench className="w-6 h-6" />,
      title: t("operations.items.project.title"),
      text: t("operations.items.project.text"),
      image: "/images/operations/project.jpg",
      alt: t("operations.items.project.alt"),
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: t("operations.items.stainless.title"),
      text: t("operations.items.stainless.text"),
      image: "/images/operations/stainless.jpg",
      alt: t("operations.items.stainless.alt"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HERO SECTION */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] opacity-5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center relative">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-300">
                {t("heroAbout.badge")}
              </p>
            </div>

            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                {t("heroAbout.title.before")}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-300">
                  {t("heroAbout.title.highlight")}
                </span>
                .
              </h1>

              <p className="text-lg sm:text-xl text-slate-200 leading-relaxed font-light">
                {t("heroAbout.text1.before")}{" "}
                <span className="font-semibold text-amber-300">
                  {t("heroAbout.text1.highlight")}
                </span>
                .
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-base text-slate-300">
  {t("heroAbout.text2.before")}{" "}
  <span className="font-medium text-white">
    {t("heroAbout.text2.highlight")}
  </span>.
</p>

                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-base text-slate-300">
  {t("heroAbout.text3.before")}{" "}
  <span className="font-medium text-white">
    {t("heroAbout.text3.highlight")}
  </span>.
</p>

                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href="/categories"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-lg hover:shadow-amber-500/25 hover:scale-[1.02] transition-all duration-300"
              >
                <span>{t("hero.buttons.products")}</span>
                <TrendingUp className="w-4 h-4" />
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-800/30 backdrop-blur-sm px-6 py-3.5 text-sm font-semibold text-white hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-300"
              >
                {t("hero.buttons.contact")}
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative w-full h-[520px] rounded-3xl overflow-hidden shadow-2xl shadow-black/30">
              <Image
                src="/images/about-hero-horecalink.jpg"
                alt={t("hero.imageAlt")}
                fill
                priority
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/45 to-transparent" />
            </div>

            {/* Görsel + Alt İstatistik Alanı */}
<div className="mt-6 w-full">
  <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div className="text-center">
      <div className="text-2xl font-bold text-slate-900">
        {t("stats.item1.value")}
      </div>
      <div className="text-xs text-slate-600 font-medium">
        {t("stats.item1.label")}
      </div>
    </div>

    <div className="text-center">
      <div className="text-2xl font-bold text-slate-900">
        {t("stats.item2.value")}
      </div>
      <div className="text-xs text-slate-600 font-medium">
        {t("stats.item2.label")}
      </div>
    </div>

    <div className="text-center">
      <div className="text-2xl font-bold text-slate-900">
        {t("stats.item3.value")}
      </div>
      <div className="text-xs text-slate-600 font-medium">
        {t("stats.item3.label")}
      </div>
    </div>
  </div>
</div>

          </div>
        </div>

        {/* Hero alt boşluk: overlay çakışmasın */}
        <div className="h-12 sm:h-14" />
      </section>

      {/* DEĞERLERİMİZ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              {t("values.title")}
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              {t("values.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {values.map((value, index) => (
              <div
                key={index}
                className="group bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 mb-4 group-hover:scale-110 transition-transform duration-300">
                  {value.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {value.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BİZ KİMİZ + MİSYON/VİZYON + HİKAYE */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                  {t("who.title")}
                </h2>

                <div className="space-y-6">
                  <p className="text-lg text-slate-700 leading-relaxed">
                    {t("who.text1.before")}{" "}
                    <span className="font-semibold text-slate-900">
                      {t("who.text1.highlight")}
                    </span>{" "}
                    {t("who.text1.after")}
                  </p>

                  <p className="text-lg text-slate-700 leading-relaxed">
                    {t("who.text2.before")}{" "}
                    <span className="font-semibold text-slate-900">
                      {t("who.text2.highlight")}
                    </span>{" "}
                    {t("who.text2.after")}
                  </p>

                  <p className="text-lg text-slate-700 leading-relaxed">
                    {t("who.text3")}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 pt-4">
                <div className="rounded-2xl bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">
                    {t("mission.title")}
                  </h3>
                  <p className="text-slate-700 leading-relaxed">
                    {t("mission.text")}
                  </p>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">
                    {t("vision.title")}
                  </h3>
                  <p className="text-slate-700 leading-relaxed">
                    {t("vision.text.before")}{" "}
                    <span className="font-semibold text-amber-600">
                      {t("vision.text.highlight")}
                    </span>{" "}
                    {t("vision.text.after")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-6">{t("story.title")}</h3>
                <div className="space-y-6">
                  {milestones.map((milestone, index) => (
                    <div key={index} className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-amber-300">
                          {milestone.year}
                        </h4>
                        <p className="text-slate-300 mt-1">{milestone.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-lg border border-slate-200">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">
                  {t("quality.title")}
                </h3>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-slate-700">
                        {t(`quality.point${i}`)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OPERASYON & SAHADAN (Team yerine) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              {t("operations.title")}
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              {t("operations.subtitle")}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {operations.map((item, idx) => (
              <div
                key={idx}
                className="group rounded-3xl overflow-hidden border border-slate-200 bg-slate-50 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
              >
                <div className="relative w-full h-64">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute left-6 bottom-6 right-6">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-white/90 backdrop-blur px-3 py-2">
                      <span className="text-amber-600">{item.icon}</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-slate-700 leading-relaxed">{item.text}</p>

                  <div className="pt-5">
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                    >
                      {t("operations.cta")}
                      <Users className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ek not / güven metni */}
          <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {t("operations.badges.b1.title")}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {t("operations.badges.b1.text")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {t("operations.badges.b2.title")}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {t("operations.badges.b2.text")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {t("operations.badges.b3.title")}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {t("operations.badges.b3.text")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA - SON ÇAĞRI */}
      <section className="relative py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/dots-pattern.svg')] opacity-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                {t("cta.title")}
              </h2>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                {t("cta.text")}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-4 text-base font-semibold text-slate-900 shadow-2xl hover:shadow-amber-500/30 hover:scale-[1.02] transition-all duration-300"
              >
                <span>{t("cta.button")}</span>
                <Users className="w-5 h-5" />
              </Link>

              {/* Portfolio yerine: Kategoriler (404 riskini sıfırlıyoruz) */}
              <Link
                href="/categories"
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-slate-600 bg-slate-800/30 backdrop-blur-sm px-8 py-4 text-base font-semibold text-white hover:bg-slate-700/50 transition-all duration-300"
              >
                {t("cta.secondaryButton")}
                <TrendingUp className="w-5 h-5" />
              </Link>
            </div>

            <div className="pt-8 border-t border-slate-700/50">
              <p className="text-sm text-slate-400">{t("cta.trustText")}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
