"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Printer,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import {
  canViewQuote,
  getQuoteStatusLabelKey,
  getGuestQuoteAccess,
  getOrCreateVisitorIdentity,
  getQuoteRequestById,
  normalizeQuoteStatus,
  saveGuestQuoteAccess,
} from "../../services/quoteService";

function formatDate(value, lang) {
  if (!value) return "-";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const localeMap = { tr: "tr-TR", ru: "ru-RU", kz: "kk-KZ", en: "en-US" };
  return new Intl.DateTimeFormat(localeMap[lang] || "tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${new Intl.NumberFormat("ru-RU").format(numeric)} T`;
}

const statusTone = {
  received: "bg-blue-50 text-blue-700",
  reviewing: "bg-amber-50 text-amber-700",
  preparing: "bg-violet-50 text-violet-700",
  offered: "bg-emerald-50 text-emerald-700",
  in_delivery: "bg-cyan-50 text-cyan-700",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-50 text-red-700",
  new: "bg-blue-50 text-blue-700",
  priced: "bg-violet-50 text-violet-700",
  answered: "bg-emerald-50 text-emerald-700",
  approved: "bg-cyan-50 text-cyan-700",
  closed: "bg-slate-100 text-slate-700",
  draft: "bg-slate-100 text-slate-700",
};

export default function QuoteDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { lang, t } = useLang();
  const id = params?.id;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const progressSteps = useMemo(
    () => [
      { key: "received", label: t("quoteDetail.progress.received") },
      { key: "reviewing", label: t("quoteDetail.progress.reviewing") },
      { key: "preparing", label: t("quoteDetail.progress.preparing") },
      { key: "offered", label: t("quoteDetail.progress.offered") },
      { key: "in_delivery", label: t("quoteDetail.progress.inDelivery") },
      { key: "completed", label: t("quoteDetail.progress.completed") },
    ],
    [t]
  );

  const visitorId = useMemo(() => getOrCreateVisitorIdentity()?.visitorId || "", []);

  const accessKey = useMemo(() => {
    const fromUrl = searchParams.get("access");
    if (fromUrl) return fromUrl;
    const localAccess = getGuestQuoteAccess(id);
    return localAccess?.accessKey || "";
  }, [id, searchParams]);

  useEffect(() => {
    if (!id) return;
    const fromUrl = searchParams.get("access");
    if (fromUrl) {
      saveGuestQuoteAccess(id, fromUrl);
    }
  }, [id, searchParams]);

  useEffect(() => {
    if (!id) return;

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getQuoteRequestById(id);
        if (!data) {
          setError(t("quoteDetail.notFound"));
          setItem(null);
          return;
        }
        setItem(data);
      } catch (err) {
        console.error(err);
        setError(t("quoteDetail.loadError"));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id, t]);

  const isAllowed = useMemo(() => {
    if (!item) return false;
    if (user?.role === "admin") return true;
    return canViewQuote(item, { userId: user?.uid, accessKey, visitorId });
  }, [accessKey, item, user?.role, user?.uid, visitorId]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f8f9fb]">
        <Loader2 className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f8f9fb] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 text-center shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
          <p className="text-lg font-bold text-[#1d3246]">{error}</p>
        </div>
      </main>
    );
  }

  if (!isAllowed) {
    return (
      <main className="min-h-screen bg-[#f8f9fb] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 text-center shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
          <p className="text-lg font-bold text-[#1d3246]">{t("quoteDetail.noAccessTitle")}</p>
          <p className="mt-3 text-sm text-slate-600">{t("quoteDetail.noAccessText")}</p>
        </div>
      </main>
    );
  }

  const rawStatusKey = item.status || "received";
  const statusKey = rawStatusKey === "new" ? "received" : normalizeQuoteStatus(rawStatusKey);
  const statusLabel = t(getQuoteStatusLabelKey(rawStatusKey));
  const activeStepIndex = Math.max(0, progressSteps.findIndex((step) => step.key === statusKey));
  const listAmount = item.pricing?.listAmount || 0;
  const specialAmount = item.pricing?.specialAmount || 0;

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 py-8 md:px-6 lg:px-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-7xl print:max-w-none">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-4">
            <Link href="/teklifler" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#1d3246]">
              <ArrowLeft size={18} />
              {t("quoteDetail.back")}
            </Link>
            <Link href="/" className="text-sm font-semibold text-slate-500 transition hover:text-[#1d3246]">
              {t("breadcrumb.home")}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#f2f4f6] px-4 py-2.5 text-sm font-bold text-[#1d3246] transition hover:bg-[#e6e8ea]"
          >
            <Printer size={18} />
            {t("quoteDetail.print")}
          </button>
        </div>

        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
              {t("quoteDetail.eyebrow")}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#1d3246] md:text-4xl">
              {item.quoteNo || item.id}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{formatDate(item.createdAt, lang)}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[statusKey] || statusTone.received}`}>
                {statusLabel}
              </span>
              {!item.userId ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {t("quoteDetail.guestRequest")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label={t("quoteDetail.metrics.items")} value={item.itemCount || item.items?.length || 0} />
            <MetricCard label={t("quoteDetail.metrics.quantity")} value={item.totalQuantity || 0} />
            <MetricCard label={t("quoteDetail.metrics.listTotal")} value={listAmount ? formatPrice(listAmount) : "-"} />
          </div>
        </div>

        <section className="mb-8 rounded-xl bg-[#f2f4f6] p-6 print:bg-white print:p-0">
          <div className="relative flex justify-between gap-3 overflow-x-auto">
            <div className="absolute left-0 right-0 top-5 hidden h-1 rounded-full bg-[#e0e3e5] md:block" />
            <div
              className="absolute left-0 top-5 hidden h-1 rounded-full bg-[#1d3246] md:block"
              style={{ width: `${(activeStepIndex / (progressSteps.length - 1)) * 100}%` }}
            />

            {progressSteps.map((step, index) => {
              const completed = index <= activeStepIndex;
              const active = index === activeStepIndex;

              return (
                <div key={step.key} className="relative z-10 flex min-w-[110px] flex-1 flex-col items-center gap-3 text-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold ${
                      completed ? "bg-[#1d3246] text-white" : "bg-[#e6e8ea] text-slate-500"
                    } ${active ? "ring-4 ring-[#b3c9e2] ring-offset-4 ring-offset-[#f2f4f6]" : ""}`}
                  >
                    {index + 1}
                  </div>

                  <span className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${completed ? "text-[#1d3246]" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="overflow-hidden rounded-xl bg-white shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_130px_120px] gap-4 bg-[#f2f4f6] px-6 py-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
              <div>{t("quoteDetail.table.product")}</div>
              <div className="text-center">{t("quoteDetail.table.quantity")}</div>
              <div className="text-right">{t("quoteDetail.table.listPrice")}</div>
              <div className="text-right">{t("quoteDetail.table.total")}</div>
            </div>

            <div>
              {(item.items || []).map((product, index) => {
                const lineListTotal =
                  product.lineListTotal || (product.listPrice || product.price || 0) * (product.quantity || 1);

                return (
                  <div
                    key={`${product.productId}-${index}`}
                    className={`grid gap-4 px-6 py-5 md:grid-cols-[minmax(0,1fr)_120px_130px_120px] md:items-center ${index % 2 === 1 ? "bg-[#f8f9fb]" : "bg-white"}`}
                  >
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                        {product.brand || product.sku || t("product")}
                      </div>
                      <div className="mt-1 text-base font-bold text-[#1d3246]">{product.name || t("product")}</div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        {product.sku ? <span>SKU: {product.sku}</span> : null}
                        <span>{t("productDetail.unit")}: {product.unit || t("unit")}</span>
                        {product.specialPrice ? <span>{t("quoteDetail.specialPriceDefined")}</span> : null}
                      </div>
                    </div>

                    <div className="text-sm font-bold text-slate-700 md:text-center">{product.quantity || 0}</div>
                    <div className="text-sm font-bold text-[#1d3246] md:text-right">
                      {product.listPrice || product.price ? formatPrice(product.listPrice || product.price) : "-"}
                    </div>
                    <div className="text-sm font-bold text-[#1d3246] md:text-right">{lineListTotal ? formatPrice(lineListTotal) : "-"}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-xl bg-white p-6 shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
              <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[#1d3246]">{t("quoteDetail.customerInfo")}</h2>
              <div className="mt-5 space-y-4 text-sm text-slate-600">
                <InfoRow icon={<User size={16} />} label={t("quoteDetail.customer.fullName")} value={item.customer?.fullName || "-"} />
                <InfoRow icon={<Building2 size={16} />} label={t("quoteDetail.customer.company")} value={item.customer?.companyName || "-"} />
                <InfoRow icon={<Phone size={16} />} label={t("quoteDetail.customer.phone")} value={item.customer?.phone || "-"} />
                <InfoRow icon={<Mail size={16} />} label={t("quoteDetail.customer.email")} value={item.customer?.email || "-"} />
                <InfoRow icon={<MapPin size={16} />} label={t("quoteDetail.customer.city")} value={item.customer?.city || item.requestedDeliveryCity || "-"} />
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
              <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[#1d3246]">{t("quoteDetail.priceSummary")}</h2>
              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow label={t("quoteDetail.summary.listTotal")} value={listAmount ? formatPrice(listAmount) : "-"} />
                <SummaryRow label={t("quoteDetail.summary.specialTotal")} value={specialAmount ? formatPrice(specialAmount) : "-"} />
                <SummaryRow label={t("quoteDetail.summary.currency")} value={item.currency || item.pricing?.currency || "KZT"} />
              </div>
              {item.pricing?.priceNote ? (
                <div className="mt-4 rounded-lg bg-[#f8f9fb] px-4 py-3 text-xs leading-5 text-slate-500">
                  {item.pricing.priceNote}
                </div>
              ) : null}
            </section>

            {item.note ? (
              <section className="rounded-xl bg-white p-6 shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
                <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[#1d3246]">{t("quoteDetail.note")}</h2>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{item.note}</p>
              </section>
            ) : null}

            {!item.userId ? (
              <section className="rounded-xl border border-[#dbe4ee] bg-white p-6 shadow-[0_20px_40px_rgba(29,50,70,0.06)]">
                <h2 className="text-lg font-extrabold text-[#1d3246]">{t("quoteDetail.guestAccessTitle")}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{t("quoteDetail.guestAccessText")}</p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-lg bg-white px-4 py-4 shadow-[0_14px_28px_rgba(29,50,70,0.05)]">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-extrabold text-[#1d3246]">{value}</div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</div>
        <div className="mt-1 text-sm font-semibold text-slate-700">{value}</div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-[#1d3246]">{value}</span>
    </div>
  );
}
