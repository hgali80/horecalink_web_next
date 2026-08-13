"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";

const TOUR_STORAGE_KEY = "horecalink_quote_request_tour_seen_v1";

function readTourSeen() {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberTourSeen() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "1");
  } catch {}
}

export default function QuotePageGuide({ t }) {
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (readTourSeen()) return;

    const timer = window.setTimeout(() => setTourOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const closeTour = () => {
    rememberTourSeen();
    setTourOpen(false);
  };

  return (
    <>
      <section className="mb-8 rounded-2xl border border-[#d7e1eb] bg-gradient-to-r from-[#eef4f8] to-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1d3246] text-white">
              <CircleHelp className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#1d3246]">{t("quoteRequest.guide.noteTitle")}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{t("quoteRequest.guide.noteText")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ol className="flex flex-wrap gap-2 text-xs font-bold text-[#1d3246]">
              {["products", "contact", "send"].map((key, index) => (
                <li key={key} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ef7d32] text-[10px] text-white">{index + 1}</span>
                  {t(`quoteRequest.guide.${key}Short`)}
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1d3246] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#243f58] focus:outline-none focus:ring-4 focus:ring-[#b3c9e2]"
            >
              <CircleHelp className="h-5 w-5" />
              {t("quoteRequest.guide.replay")}
            </button>
          </div>
        </div>
      </section>

      {tourOpen ? <GuidedTour t={t} onClose={closeTour} /> : null}
    </>
  );
}

function GuidedTour({ t, onClose }) {
  const steps = useMemo(
    () => [
      {
        target: '[data-quote-tour="products"]',
        title: t("quoteRequest.tour.productsTitle"),
        text: t("quoteRequest.tour.productsText"),
      },
      {
        target: '[data-quote-tour="contact"]',
        title: t("quoteRequest.tour.contactTitle"),
        text: t("quoteRequest.tour.contactText"),
      },
      {
        target: '[data-quote-tour="submit"]',
        title: t("quoteRequest.tour.submitTitle"),
        text: t("quoteRequest.tour.submitText"),
      },
      {
        target: '[data-quote-tour="history"]',
        title: t("quoteRequest.tour.historyTitle"),
        text: t("quoteRequest.tour.historyText"),
      },
    ],
    [t]
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const step = steps[stepIndex];

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && stepIndex < steps.length - 1) setStepIndex((current) => current + 1);
      if (event.key === "ArrowLeft" && stepIndex > 0) setStepIndex((current) => current - 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, stepIndex, steps.length]);

  useEffect(() => {
    const target = document.querySelector(step.target);
    if (!target) {
      return undefined;
    }

    const updateRect = () => setTargetRect(target.getBoundingClientRect());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
    updateRect();

    const timer = window.setTimeout(updateRect, reduceMotion ? 0 : 450);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [step.target]);

  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const tooltipWidth = Math.min(380, viewportWidth - 24);
  const tooltipHeightEstimate = 255;
  const safeRect = targetRect || {
    top: viewportHeight / 2 - 40,
    bottom: viewportHeight / 2 + 40,
    left: viewportWidth / 2 - 100,
    right: viewportWidth / 2 + 100,
    width: 200,
    height: 80,
  };
  const highlightLeft = Math.max(8, safeRect.left - 8);
  const highlightTop = Math.max(8, safeRect.top - 8);
  const highlightWidth = Math.min(viewportWidth - highlightLeft - 8, safeRect.width + 16);
  const highlightHeight = Math.min(viewportHeight - highlightTop - 8, safeRect.height + 16);
  const placeBelow = safeRect.bottom + tooltipHeightEstimate + 24 < viewportHeight || safeRect.top < tooltipHeightEstimate + 24;
  const tooltipTop = placeBelow
    ? Math.min(viewportHeight - tooltipHeightEstimate - 12, safeRect.bottom + 18)
    : Math.max(12, safeRect.top - tooltipHeightEstimate - 18);
  const tooltipLeft = Math.max(12, Math.min(viewportWidth - tooltipWidth - 12, safeRect.left + safeRect.width / 2 - tooltipWidth / 2));
  const arrowLeft = Math.max(22, Math.min(tooltipWidth - 30, safeRect.left + safeRect.width / 2 - tooltipLeft));

  return (
    <div role="dialog" aria-modal="true" aria-label={t("quoteRequest.tour.dialogLabel")}>
      <div className="fixed inset-0 z-[70]" aria-hidden="true" />
      <div
        className="pointer-events-none fixed z-[71] rounded-2xl border-2 border-[#ef7d32] shadow-[0_0_0_9999px_rgba(15,23,42,0.68)] transition-all duration-300"
        style={{ left: highlightLeft, top: highlightTop, width: highlightWidth, height: highlightHeight }}
        aria-hidden="true"
      />

      <div
        className="fixed z-[72] rounded-2xl bg-white p-5 shadow-2xl md:p-6"
        style={{ left: tooltipLeft, top: tooltipTop, width: tooltipWidth }}
      >
        <span
          className={`absolute h-4 w-4 rotate-45 bg-white ${placeBelow ? "-top-2" : "-bottom-2"}`}
          style={{ left: arrowLeft }}
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ef7d32]">
              {t("quoteRequest.tour.step", { current: stepIndex + 1, total: steps.length })}
            </span>
            <button type="button" onClick={onClose} className="-mr-2 -mt-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100" aria-label={t("quoteRequest.tour.close")}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <h2 className="mt-2 text-xl font-extrabold text-[#1d3246]">{step.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="text-sm font-bold text-slate-500 transition hover:text-[#1d3246]">
              {t("quoteRequest.tour.skip")}
            </button>

            <div className="flex gap-2">
              {stepIndex > 0 ? (
                <button type="button" onClick={() => setStepIndex((current) => current - 1)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#1d3246] transition hover:bg-slate-50">
                  <ArrowLeft className="h-4 w-4" />
                  {t("quoteRequest.tour.back")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => (stepIndex === steps.length - 1 ? onClose() : setStepIndex((current) => current + 1))}
                className="inline-flex items-center gap-1 rounded-xl bg-[#1d3246] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#243f58]"
              >
                {stepIndex === steps.length - 1 ? t("quoteRequest.tour.finish") : t("quoteRequest.tour.next")}
                {stepIndex < steps.length - 1 ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
