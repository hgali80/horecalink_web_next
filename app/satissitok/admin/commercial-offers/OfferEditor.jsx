"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileDown,
  PlusCircle,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import { getSettings } from "@/app/satissitok/services/settingsService";
import { listProductsAdmin } from "@/app/satissitok/services/productService";
import { listCaris } from "@/app/satissitok/admin/cari/services/cariService";
import {
  buildDefaultOfferPayload,
  buildOfferItemFromProduct,
  calculateOfferTotals,
  createCommercialOffer,
  createCommercialOfferFromQuoteRequest,
  getCommercialOffer,
  getCommercialOfferByQuoteRequest,
  getQuoteRequest,
  getNextCommercialOfferMeta,
  getOfferTypeConfig,
  OFFER_TYPE_CONFIGS,
  saveCommercialOffer,
} from "@/app/satissitok/services/commercialOfferService";

const LOGO_SRC = "/horecalink_offer_logo_white_v2.png";
const OFFER_TYPE_OPTIONS = ["stainless", "industrial", "corporate"];
const PDF_IMAGE_TIMEOUT_MS = 15000;

function text(value) {
  return String(value ?? "");
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value) {
  return `${number(value).toLocaleString("ru-RU")} ₸`;
}

function formatDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTimeStamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatItemMeta(item) {
  return [text(item.sku), text(item.brand)].filter(Boolean).join("  •  ");
}

function formatItemQuantity(item) {
  const quantity = number(item.quantity);
  const unit = text(item.unit);
  return `${quantity.toLocaleString("ru-RU")} ${unit}`.trim();
}

function splitLines(value) {
  return text(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function getPrintableImageSrc(value) {
  const src = text(value).trim();
  if (!src || typeof window === "undefined") return src;

  try {
    const url = new URL(src, window.location.origin);
    if (url.origin === window.location.origin) return url.href;

    if (url.hostname === "firebasestorage.googleapis.com") {
      return `/api/pdf-image?url=${encodeURIComponent(url.href)}`;
    }
  } catch {
    return src;
  }

  return src;
}

function waitForImage(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
      resolve(loaded);
    };
    const handleLoad = () => finish(true);
    const handleError = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(false), PDF_IMAGE_TIMEOUT_MS);

    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
  });
}

async function preparePrintableImages(container) {
  const images = Array.from(container.querySelectorAll("img"));
  const originals = images.map((image) => ({
    image,
    src: image.getAttribute("src"),
    visibility: image.style.visibility,
  }));

  await Promise.all(
    images.map(async (image) => {
      const printableSrc = getPrintableImageSrc(image.getAttribute("src"));
      if (printableSrc && image.src !== printableSrc) {
        image.src = printableSrc;
      }

      const loaded = await waitForImage(image);
      if (!loaded) image.style.visibility = "hidden";
    })
  );

  return () => {
    originals.forEach(({ image, src, visibility }) => {
      if (src === null) image.removeAttribute("src");
      else image.setAttribute("src", src);
      image.style.visibility = visibility;
    });
  };
}

function emptyItem(unit = "шт") {
  return {
    rowId: `manual_${Math.random().toString(36).slice(2, 8)}`,
    productId: "",
    sku: "",
    brand: "",
    imageUrl: "",
    imageName: "",
    name: "",
    description: "",
    quantity: 1,
    unit,
    unitPrice: 0,
  };
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function buildFormFromQuoteRequest(baseForm, request, products, defaultUnit) {
  const customer = request?.customer || {};
  const requestItems = Array.isArray(request?.items) ? request.items : [];
  const importedItems = requestItems.map((item, index) => {
    const identifiers = [
      item?.fulfilledProduct?.productId,
      item?.requestedProduct?.productId,
      item?.productId,
      item?.sku,
    ]
      .filter(Boolean)
      .map(String);
    const product = products.find((entry) =>
      [entry.id, entry.stock_code, entry.sku]
        .filter(Boolean)
        .some((value) => identifiers.includes(String(value)))
    );
    const productDefaults = product
      ? buildOfferItemFromProduct(product, defaultUnit)
      : emptyItem(defaultUnit);
    const requestedUnitPrice = number(
      firstValue(
        item?.specialPrice,
        item?.requestedPrice,
        item?.pricing?.offeredUnitPrice,
        item?.listPrice,
        item?.pricing?.listUnitPrice,
        item?.price
      )
    );

    return {
      ...productDefaults,
      rowId: `quote_${index + 1}_${identifiers[0] || "item"}`,
      productId: text(product?.id || identifiers[0]),
      sku: text(item?.sku || product?.sku || product?.stock_code || identifiers[0]),
      brand: text(item?.brand || productDefaults.brand),
      name: text(
        item?.fulfilledProduct?.name ||
          item?.requestedProduct?.name ||
          item?.name ||
          productDefaults.name
      ),
      description: text(item?.description || productDefaults.description),
      quantity: number(
        firstValue(item?.qtyOffered, item?.qtyRequested, item?.quantity),
        1
      ),
      unit: text(item?.unit || productDefaults.unit || defaultUnit),
      unitPrice: requestedUnitPrice || number(productDefaults.unitPrice),
    };
  });
  const requestNo = text(
    request?.quoteNo || request?.requestNo || request?.quoteId || request?.id
  );

  return {
    ...baseForm,
    sourceQuoteRequestId: request.id,
    source: {
      type: "quote_request",
      quoteRequestId: request.id,
      requestNo,
    },
    buyer: {
      ...baseForm.buyer,
      companyName: text(customer.company || customer.companyName),
      bin: text(customer.bin || customer.iin),
      address: text(customer.address || request?.requestMeta?.deliveryAddress),
      contactName: text(customer.name || customer.fullName),
      phone: text(customer.phone),
      email: text(customer.email),
    },
    items: importedItems.length ? importedItems : baseForm.items,
  };
}

function ProductImage({ src, alt, sizeClass = "w-24" }) {
  if (!src) {
    return (
      <div className={`flex aspect-square ${sizeClass} items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2 text-center text-[11px] text-[#94a3b8]`}>
        Фото товара
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`aspect-square ${sizeClass} rounded-xl border border-[#e2e8f0] object-cover`} />;
}

export default function OfferEditor({ offerId = null, sourceRequestId = null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [form, setForm] = useState(null);
  const [products, setProducts] = useState([]);
  const [caris, setCaris] = useState([]);
  const [units, setUnits] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [message, setMessage] = useState("");
  const pdfContentRef = useRef(null);
  const generatedAt = useMemo(() => new Date(), []);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const [settings, productList, cariList, existingOffer, nextMeta, sourceRequest, linkedOffer] = await Promise.all([
          getSettings(),
          listProductsAdmin(),
          listCaris(),
          offerId ? getCommercialOffer(offerId) : Promise.resolve(null),
          offerId ? Promise.resolve(null) : getNextCommercialOfferMeta(),
          !offerId && sourceRequestId ? getQuoteRequest(sourceRequestId) : Promise.resolve(null),
          !offerId && sourceRequestId
            ? getCommercialOfferByQuoteRequest(sourceRequestId)
            : Promise.resolve(null),
        ]);

        if (!alive) return;

        if (linkedOffer) {
          router.replace(`/satissitok/admin/commercial-offers/${linkedOffer.id}`);
          return;
        }

        setProducts(productList.filter((item) => item.active !== false));
        setCaris(cariList);
        setUnits(settings.units || []);

        const defaultVatRate =
          settings.taxes?.vat?.find((item) => item.default)?.rate ||
          settings.taxes?.vat?.[0]?.rate ||
          12;

        if (existingOffer) {
          const normalized = calculateOfferTotals(existingOffer.items || [], existingOffer.vatRate || 12);
          setForm({
            ...buildDefaultOfferPayload({
              units: settings.units || [],
              vatRate: defaultVatRate,
            }),
            ...existingOffer,
            items: normalized.items,
            totals: normalized.totals,
            terms: {
              delivery: existingOffer.terms?.delivery || [],
              payment: existingOffer.terms?.payment || [],
              warranty: existingOffer.terms?.warranty || [],
            },
            visibility: {
              termsSection: existingOffer.visibility?.termsSection ?? true,
              vatSummary: existingOffer.visibility?.vatSummary ?? true,
              requisitesSection: existingOffer.visibility?.requisitesSection ?? true,
            },
          });
        } else {
          const baseForm = buildDefaultOfferPayload({
            offerNo: nextMeta?.offerNo || "",
            sequence: nextMeta?.sequence || 0,
            units: settings.units || [],
            vatRate: defaultVatRate,
          });
          const importUnit =
            settings.units?.find((item) => item.default)?.label ||
            settings.units?.[0]?.label ||
            "шт";
          setForm(
            sourceRequest
              ? buildFormFromQuoteRequest(baseForm, sourceRequest, productList, importUnit)
              : baseForm
          );
          if (sourceRequest) {
            setMessage("Web teklif talebindeki müşteri ve ürünler otomatik aktarıldı.");
          } else if (sourceRequestId) {
            setMessage("Kaynak web teklif talebi bulunamadı.");
          }
        }
      } catch (error) {
        console.error("Commercial offer editor load error:", error);
        if (alive) setMessage("Teklif ekranı yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [offerId, router, sourceRequestId]);

  const defaultUnit = useMemo(
    () => units.find((item) => item.default)?.label || units[0]?.label || "шт",
    [units]
  );

  const calculated = useMemo(() => {
    if (!form) return { items: [], totals: { grandTotal: 0, vatAmount: 0, vatRate: 12 } };
    return calculateOfferTotals(form.items || [], form.vatRate || 12);
  }, [form]);

  const offerTypeConfig = useMemo(
    () => getOfferTypeConfig(form?.offerType || "stainless"),
    [form?.offerType]
  );

  const filteredProducts = useMemo(() => {
    const queryText = productQuery.trim().toLowerCase();
    return products
      .filter((item) => {
        if (!queryText) return true;
        return [item.name, item.stock_code, item.sku, item.brand]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(queryText));
      })
      .slice(0, 60);
  }, [productQuery, products]);

  useEffect(() => {
    if (!form?.items?.length || !products.length) return;

    setForm((prev) => {
      if (!prev?.items?.length) return prev;

      let changed = false;
      const nextItems = prev.items.map((item) => {
        if (item.imageUrl && item.description) return item;

        const product = products.find((entry) =>
          [entry.id, entry.stock_code, entry.sku].filter(Boolean).includes(item.productId || item.sku)
        );

        if (!product) return item;

        const productDefaults = buildOfferItemFromProduct(product, item.unit || defaultUnit);
        const nextItem = {
          ...item,
          imageUrl: item.imageUrl || productDefaults.imageUrl,
          imageName: item.imageName || productDefaults.imageName,
          description: item.description || productDefaults.description,
        };

        if (
          nextItem.imageUrl !== item.imageUrl ||
          nextItem.imageName !== item.imageName ||
          nextItem.description !== item.description
        ) {
          changed = true;
        }

        return nextItem;
      });

      return changed ? { ...prev, items: nextItems } : prev;
    });
  }, [defaultUnit, form?.items, products]);

  function updateField(path, value) {
    setForm((prev) => {
      if (!prev) return prev;
      const keys = path.split(".");
      const next = { ...prev };
      let cursor = next;

      for (let i = 0; i < keys.length - 1; i += 1) {
        cursor[keys[i]] = { ...(cursor[keys[i]] || {}) };
        cursor = cursor[keys[i]];
      }

      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  }

  function updateItem(rowId, field, value) {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: (prev.items || []).map((item) =>
          item.rowId === rowId ? { ...item, [field]: value } : item
        ),
      };
    });
  }

  function addManualRow() {
    setForm((prev) => ({
      ...prev,
      items: [...(prev.items || []), emptyItem(defaultUnit)],
    }));
  }

  function removeRow(rowId) {
    setForm((prev) => ({
      ...prev,
      items: (prev.items || []).filter((item) => item.rowId !== rowId),
    }));
  }

  function handleCariSelect(cariId) {
    updateField("buyer.cariId", cariId);
    const cari = caris.find((item) => item.id === cariId);
    if (!cari) return;

    setForm((prev) => ({
      ...prev,
      buyer: {
        ...prev.buyer,
        cariId,
        companyName: cari.firm || prev.buyer.companyName,
        bin: cari.bin || prev.buyer.bin,
        address: cari.legalAddress || prev.buyer.address,
        phone: cari.mobile || prev.buyer.phone,
        contactName: cari.director || prev.buyer.contactName,
      },
    }));
  }

  function addSelectedProduct() {
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) return;

    setForm((prev) => ({
      ...prev,
      items: [...(prev.items || []), buildOfferItemFromProduct(product, defaultUnit)],
    }));
    setSelectedProductId("");
    setProductQuery("");
  }

  function applyOfferType(nextOfferType) {
    const nextConfig = getOfferTypeConfig(nextOfferType);

    setForm((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        offerType: nextOfferType,
        seller: {
          ...prev.seller,
          tagline: nextConfig.sellerTagline,
        },
        introText: nextConfig.introText,
        priceNote: nextConfig.priceNote,
        terms: {
          delivery: [...nextConfig.terms.delivery],
          payment: [...nextConfig.terms.payment],
          warranty: [...nextConfig.terms.warranty],
        },
        visibility: {
          termsSection: prev.visibility?.termsSection ?? true,
          vatSummary: prev.visibility?.vatSummary ?? true,
          requisitesSection: prev.visibility?.requisitesSection ?? true,
        },
      };
    });
  }

  async function handleSave() {
    if (!form) return;
    try {
      setSaving(true);
      setMessage("");

      const payload = {
        ...form,
        items: calculated.items,
        totals: calculated.totals,
        terms: {
          delivery: form.terms?.delivery || [],
          payment: form.terms?.payment || [],
          warranty: form.terms?.warranty || [],
        },
      };

      if (offerId) {
        await saveCommercialOffer(offerId, payload);
        setMessage("Teklif güncellendi.");
      } else {
        if (sourceRequestId) {
          const existing = await getCommercialOfferByQuoteRequest(sourceRequestId);
          if (existing) {
            router.replace(`/satissitok/admin/commercial-offers/${existing.id}`);
            return;
          }
        }
        const newId = sourceRequestId
          ? await createCommercialOfferFromQuoteRequest(payload, sourceRequestId)
          : await createCommercialOffer(payload);
        setMessage("Teklif oluşturuldu.");
        router.replace(`/satissitok/admin/commercial-offers/${newId}`);
      }
    } catch (error) {
      console.error("Commercial offer save error:", error);
      setMessage("Teklif kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint() {
    if (!form) return;

    const previousTitle = document.title;
    let restoreImages = null;

    try {
      setMessage("");
      restoreImages = await preparePrintableImages(pdfContentRef.current);
      await document.fonts?.ready;
      document.title = form.offerNo || "HorecaLink";
      window.print();
    } catch (error) {
      console.error("Commercial offer print error:", error);
      setMessage("Yazdırma penceresi açılamadı.");
    } finally {
      document.title = previousTitle;
      restoreImages?.();
    }
  }

  async function handleSavePdf() {
    if (!form) return;

    try {
      setSavingPdf(true);
      setMessage("");
      const [{ pdf }, { default: CommercialOfferPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./CommercialOfferPdf"),
      ]);
      const origin = window.location.origin;
      const offerForPdf = {
        ...form,
        items: calculated.items.map((item) => {
          const printableSrc = getPrintableImageSrc(item.imageUrl);
          return {
            ...item,
            pdfImageUrl: printableSrc ? new URL(printableSrc, origin).href : "",
          };
        }),
      };
      const documentElement = createElement(CommercialOfferPdf, {
        offer: offerForPdf,
        totals: calculated.totals,
        typeConfig: offerTypeConfig,
        logoUrl: new URL("/pdf/horecalink_logo_white_v2.png", origin).href,
        fontUrl: new URL("/pdf/NotoSans.ttf", origin).href,
      });
      const blob = await pdf(documentElement).toBlob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${form.offerNo || "HorecaLink-teklif"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      console.error("Commercial offer pdf error:", error);
      setMessage("PDF oluşturulamadı.");
    } finally {
      setSavingPdf(false);
    }
  }

  if (loading || !form) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Yukleniyor...</div>;
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
          }

          * {
            box-sizing: border-box;
          }

          header,
          nav,
          footer {
            display: none !important;
          }

          .offer-screen {
            display: none !important;
          }

          .offer-print {
            display: block !important;
          }

          .offer-print-sheet {
            width: 186mm !important;
            max-width: 186mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }

          .offer-print-root {
            width: 186mm !important;
            max-width: 186mm !important;
            overflow: hidden !important;
          }

          .offer-pdf-item,
          .offer-summary-block,
          .offer-terms-block,
          .offer-bank-block,
          .offer-signature-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .offer-pdf-grid {
            grid-template-columns: 30px 88px minmax(0, 1fr) 82px 96px 108px !important;
          }

          .offer-pdf-desc {
            min-width: 0;
          }

          .offer-pdf-desc,
          .offer-pdf-note,
          .offer-pdf-meta {
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>

      <div className="min-h-screen bg-[#f5f7fb] p-6">
        <div className="offer-screen mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/satissitok/admin/commercial-offers"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                <ArrowLeft size={16} />
                Geri
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Teklif Oluşturma</h1>
                <p className="text-sm text-slate-500">Ziyaretçi tekliflerinden bağımsız admin ticari teklif alanı.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                <Printer size={16} />
                Yazdır
              </button>
              <button
                type="button"
                onClick={handleSavePdf}
                disabled={savingPdf}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                <FileDown size={16} />
                PDF olarak Yazdır
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1d3246] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>

          {message ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              {message}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Teklif Bilgileri</h2>
                  <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    {form.offerNo}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="mb-2 text-sm font-semibold text-slate-700">Teklif Tipi</div>
                  <div className="flex flex-wrap gap-2">
                    {OFFER_TYPE_OPTIONS.map((offerType) => {
                      const active = (form.offerType || "stainless") === offerType;
                      return (
                        <button
                          key={offerType}
                          type="button"
                          onClick={() => applyOfferType(offerType)}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? "bg-[#1d3246] text-white shadow-sm"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          {OFFER_TYPE_CONFIGS[offerType]?.label || offerType}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm text-slate-600">
                    Teklif No
                    <input
                      value={form.offerNo}
                      onChange={(event) => updateField("offerNo", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Tarih
                    <input
                      type="date"
                      value={form.issueDate}
                      onChange={(event) => updateField("issueDate", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Gecerlilik Gun
                    <input
                      type="number"
                      min="1"
                      value={form.validDays}
                      onChange={(event) => updateField("validDays", number(event.target.value, 7))}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">Müşteri Bilgileri</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Cari Sec
                    <select
                      value={form.buyer.cariId || ""}
                      onChange={(event) => handleCariSelect(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    >
                      <option value="">Manuel musteri</option>
                      {caris.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.firm || item.director || item.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-600">
                    Firma
                    <input
                      value={form.buyer.companyName}
                      onChange={(event) => updateField("buyer.companyName", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    BIN / IIN
                    <input
                      value={form.buyer.bin}
                      onChange={(event) => updateField("buyer.bin", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Yetkili
                    <input
                      value={form.buyer.contactName}
                      onChange={(event) => updateField("buyer.contactName", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Telefon
                    <input
                      value={form.buyer.phone}
                      onChange={(event) => updateField("buyer.phone", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    E-posta
                    <input
                      value={form.buyer.email}
                      onChange={(event) => updateField("buyer.email", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-600 md:col-span-2">
                    Adres
                    <textarea
                      rows={3}
                      value={form.buyer.address}
                      onChange={(event) => updateField("buyer.address", event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Ürünler</h2>
                  <div className="text-sm text-slate-500">Toplam satır: {form.items.length}</div>
                </div>

                <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_1fr_auto_auto]">
                  <input
                    value={productQuery}
                    onChange={(event) => setProductQuery(event.target.value)}
                    placeholder="Urun, stok kodu veya marka ara..."
                    className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  />
                  <select
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  >
                    <option value="">Ürün seç</option>
                    {filteredProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} {product.stock_code ? `(${product.stock_code})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addSelectedProduct}
                    disabled={!selectedProductId}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Ürün Ekle
                  </button>
                  <button
                    type="button"
                    onClick={addManualRow}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    <PlusCircle size={16} />
                    Manuel Satır
                  </button>
                </div>

                <div className="space-y-4">
                  {calculated.items.map((item, index) => (
                    <div key={item.rowId} className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-900">Satır {index + 1}</div>
                        <button
                          type="button"
                          onClick={() => removeRow(item.rowId)}
                          className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                        >
                          <Trash2 size={14} />
                          Sil
                        </button>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[140px_1fr]">
                        <div className="space-y-2">
                          <ProductImage src={item.imageUrl} alt={item.name || "Product"} />
                          <input
                            value={item.imageUrl || ""}
                            onChange={(event) => updateItem(item.rowId, "imageUrl", event.target.value)}
                            placeholder="Gorsel URL"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none"
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm text-slate-600 md:col-span-2">
                            Ürün Adı
                            <input
                              value={item.name}
                              onChange={(event) => updateItem(item.rowId, "name", event.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                            />
                          </label>
                          <label className="text-sm text-slate-600">
                            SKU
                            <input
                              value={item.sku}
                              onChange={(event) => updateItem(item.rowId, "sku", event.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                            />
                          </label>
                          <label className="text-sm text-slate-600">
                            Marka
                            <input
                              value={item.brand}
                              onChange={(event) => updateItem(item.rowId, "brand", event.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                            />
                          </label>
                          <label className="text-sm text-slate-600 md:col-span-2">
                            Özellikler / Açıklama
                            <textarea
                              rows={4}
                              value={item.description}
                              onChange={(event) => updateItem(item.rowId, "description", event.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                            />
                          </label>
                          <label className="text-sm text-slate-600">
                            Miktar
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(event) => updateItem(item.rowId, "quantity", number(event.target.value))}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                            />
                          </label>
                          <label className="text-sm text-slate-600">
                            Birim
                            <input
                              value={item.unit}
                              onChange={(event) => updateItem(item.rowId, "unit", event.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                            />
                          </label>
                          <label className="text-sm text-slate-600">
                            Birim Fiyat
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice}
                              onChange={(event) => updateItem(item.rowId, "unitPrice", number(event.target.value))}
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                            />
                          </label>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Satır Toplam</div>
                            <div className="mt-2 text-xl font-bold text-slate-900">{formatMoney(item.lineTotal)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">Metinler ve Şartlar</h2>
                <label className="mb-4 block text-sm text-slate-600">
                  Giriş Metni
                  <textarea
                    rows={5}
                    value={form.introText}
                    onChange={(event) => updateField("introText", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  />
                </label>
                <label className="mb-4 block text-sm text-slate-600">
                  Alt Not
                  <input
                    value={form.priceNote}
                    onChange={(event) => updateField("priceNote", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  />
                </label>
                <label className="mb-4 block text-sm text-slate-600">
                  Teslimat Şartları
                  <textarea
                    rows={5}
                    value={joinLines(form.terms.delivery)}
                    onChange={(event) => updateField("terms.delivery", splitLines(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  />
                </label>
                <label className="mb-4 block text-sm text-slate-600">
                  Ödeme Şartları
                  <textarea
                    rows={5}
                    value={joinLines(form.terms.payment)}
                    onChange={(event) => updateField("terms.payment", splitLines(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  />
                </label>
                <label className="block text-sm text-slate-600">
                  Garanti
                  <textarea
                    rows={5}
                    value={joinLines(form.terms.warranty)}
                    onChange={(event) => updateField("terms.warranty", splitLines(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  />
                </label>

                <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">Gorunum Secenekleri</div>
                  <label className="flex items-center gap-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.visibility?.termsSection ?? true}
                      onChange={(event) => updateField("visibility.termsSection", event.target.checked)}
                    />
                    Sartlar blogu teklifte gorunsun
                  </label>
                  <label className="flex items-center gap-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.visibility?.vatSummary ?? true}
                      onChange={(event) => updateField("visibility.vatSummary", event.target.checked)}
                    />
                    Vergi gostergesi teklifte gorunsun
                  </label>
                  <label className="flex items-center gap-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.visibility?.requisitesSection ?? true}
                      onChange={(event) => updateField("visibility.requisitesSection", event.target.checked)}
                    />
                    Rekvizitler PDF&apos;de gorunsun
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">Toplamlar</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-500">Genel Toplam</span>
                    <span className="text-lg font-bold text-slate-900">{formatMoney(calculated.totals.grandTotal)}</span>
                  </div>
                  {form.visibility?.vatSummary ?? true ? (
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-500">KDV %{form.vatRate}</span>
                      <span className="font-bold text-slate-900">{formatMoney(calculated.totals.vatAmount)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div ref={pdfContentRef} className="offer-print offer-print-root hidden bg-white text-[#2b2f33]">
          <div className="offer-print-sheet mx-auto w-[794px] max-w-[794px] px-6 pb-4 pt-12 text-[13px] leading-[1.35]">
            <div className="mb-10 flex items-start justify-between gap-8">
              <div className="w-[140px] text-[12px] text-[#2b2f33]">{formatDateTimeStamp(generatedAt)}</div>
              <div className="flex-1 text-center text-[12px] text-[#2b2f33]">{form.offerNo || "HorecaLink"}</div>
              <div className="w-[140px]" />
            </div>

            <div className="mb-8 grid grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)] items-start gap-8">
              <div className="pt-0">
                <div className="h-[92px] w-full max-w-[350px] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={LOGO_SRC} alt="HorecaLink" className="h-full w-full object-contain object-left" />
                </div>
              </div>

              <div className="ml-auto mt-[2px] w-full max-w-[350px] rounded-[22px] border border-[#d7dee6] bg-[#f8fafc] px-5 py-5">
                <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
                  {"\u041a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435"}
                </div>
                <div className="flex items-end justify-between gap-4 border-b border-[#d7dee6] pb-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">{"\u041d\u043e\u043c\u0435\u0440"}</div>
                    <div className="mt-1 text-[24px] font-extrabold text-[#22364d]">{form.offerNo}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">{"\u0414\u0430\u0442\u0430"}</div>
                    <div className="mt-1 text-[14px] font-semibold text-[#334155]">{formatDateLabel(form.issueDate)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[13px] text-[#475569]">
                  <span className="font-semibold">{"\u0421\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f"}</span>
                  <span>{form.validDays} {"\u0434\u043d\u0435\u0439"}</span>
                </div>
              </div>
            </div>

            <div className="mb-5 border-b border-[#d7dee6] pb-4 text-center text-[#22364d]">
              <div className="text-[28px] font-extrabold italic uppercase leading-none">{"\u041a\u041e\u041c\u041c\u0415\u0420\u0427\u0415\u0421\u041a\u041e\u0415 \u041f\u0420\u0415\u0414\u041b\u041e\u0416\u0415\u041d\u0418\u0415"}</div>
              <div className="mt-2 text-[15px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{offerTypeConfig.titleLine}</div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4">
              <div className="rounded-[20px] border border-[#d7dee6] bg-[#f8fafc] p-4 text-[14px]">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#64748b]">{offerTypeConfig.sellerRole}</div>
                <div className="mb-1 text-[18px] font-bold text-[#22364d]">{form.seller.companyName}</div>
                <div>{form.seller.brandName}</div>
                <div>{offerTypeConfig.sellerCaption}</div>
                <div>{"\u0411\u0418\u041d:"} {form.seller.bin}</div>
                <div>{form.seller.address}</div>
              </div>
              <div className="rounded-[20px] border border-[#d7dee6] bg-white p-4 text-[14px]">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#64748b]">{"\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c"}</div>
                {text(form.buyer.companyName).trim() ? <div>{"\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u044f:"} {form.buyer.companyName}</div> : null}
                {text(form.buyer.bin).trim() ? <div>{"\u0411\u0418\u041d/\u0418\u0418\u041d:"} {form.buyer.bin}</div> : null}
                {text(form.buyer.contactName).trim() ? <div>{"\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e:"} {form.buyer.contactName}</div> : null}
                {text(form.buyer.phone).trim() ? <div>{"\u0422\u0435\u043b\u0435\u0444\u043e\u043d:"} {form.buyer.phone}</div> : null}
                {text(form.buyer.email).trim() ? <div>E-mail: {form.buyer.email}</div> : null}
                {text(form.buyer.address).trim() ? <div>{"\u0410\u0434\u0440\u0435\u0441:"} {form.buyer.address}</div> : null}
              </div>
            </div>

            <div className="mb-4 rounded-[24px] border border-[#d7dee6] bg-white p-3">
              <div className="offer-pdf-grid mb-3 grid items-center gap-3 rounded-[18px] bg-[#22364d] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                <div className="text-center">{"\u2116"}</div>
                <div className="text-center">{"\u0424\u043e\u0442\u043e"}</div>
                <div>{"\u0422\u043e\u0432\u0430\u0440 / \u0425\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043a\u0438"}</div>
                <div className="text-right">{"\u041a\u043e\u043b-\u0432\u043e"}</div>
                <div className="text-right">{"\u0426\u0435\u043d\u0430"}</div>
                <div className="text-right">{"\u0421\u0443\u043c\u043c\u0430"}</div>
              </div>

              <div className="space-y-3">
                {calculated.items.map((item, index) => (
                  <div key={item.rowId} className="offer-pdf-item rounded-[18px] border border-[#d7dee6] bg-[#fcfdff] px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                    <div className="offer-pdf-grid grid items-start gap-3">
                      <div className="pt-2 text-center text-[15px] font-bold text-[#22364d]">{index + 1}</div>
                      <div className="flex justify-center">
                        <ProductImage src={item.imageUrl} alt={item.name || "Product"} sizeClass="w-[84px]" />
                      </div>
                      <div className="offer-pdf-desc min-w-0">
                        <div className="text-[15px] font-extrabold italic leading-[1.2] text-[#22364d]">{item.name || "\u0422\u043e\u0432\u0430\u0440"}</div>
                        {formatItemMeta(item) ? (
                          <div className="offer-pdf-meta mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                            {formatItemMeta(item)}
                          </div>
                        ) : null}
                        {item.description ? (
                          <div className="offer-pdf-note mt-3 whitespace-pre-line text-[13px] leading-[1.5] text-[#334155]">
                            {item.description}
                          </div>
                        ) : (
                          <div className="mt-3 text-[13px] text-[#94a3b8]">{"\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e"}</div>
                        )}
                      </div>
                      <div className="pt-2 text-right text-[14px] font-semibold text-[#22364d]">{formatItemQuantity(item)}</div>
                      <div className="pt-2 text-right text-[14px] font-semibold text-[#22364d]">{formatMoney(item.unitPrice)}</div>
                      <div className="pt-2 text-right text-[14px] font-extrabold text-[#22364d]">{formatMoney(item.lineTotal)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="offer-summary-block mb-10 flex justify-end">
              <div className="w-full max-w-[440px] rounded-[28px] border border-[#c7d3e0] bg-[linear-gradient(135deg,#22364d_0%,#304a66_100%)] px-6 py-6 text-white shadow-[0_18px_44px_rgba(15,23,42,0.2)]">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[rgba(255,255,255,0.7)]">{"\u041e\u0431\u0449\u0438\u0439 \u0438\u0442\u043e\u0433"}</div>
                    <div className="mt-2 text-[24px] font-extrabold leading-none">{"\u0418\u0442\u043e\u0433\u043e:"}</div>
                  </div>
                  <span className="text-[34px] font-extrabold leading-none">{formatMoney(calculated.totals.grandTotal)}</span>
                </div>
                {form.visibility?.vatSummary ?? true ? (
                  <div className="mt-3 rounded-2xl bg-[rgba(255,255,255,0.1)] px-4 py-3 text-right text-[15px] text-[rgba(255,255,255,0.88)]">
                    <span>{`\u0412 \u0442\u043e\u043c \u0447\u0438\u0441\u043b\u0435 \u041d\u0414\u0421 ${form.vatRate}%: ${formatMoney(calculated.totals.vatAmount)}`}</span>
                  </div>
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-[20px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.12)] px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[rgba(255,255,255,0.7)]">{"\u041f\u043e\u0437\u0438\u0446\u0438\u0439"}</div>
                    <div className="mt-2 text-[24px] font-extrabold leading-none">{calculated.items.length}</div>
                  </div>
                  <div className="rounded-[20px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.12)] px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[rgba(255,255,255,0.7)]">{"\u0421\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f"}</div>
                    <div className="mt-2 text-[24px] font-extrabold leading-none">{form.validDays} {"\u0434\u043d."}</div>
                  </div>
                </div>
              </div>
            </div>

            {form.visibility?.termsSection ?? true ? (
              <div className="offer-terms-block avoid-break mb-6 grid grid-cols-3 gap-4">
                <div className="rounded-[20px] border border-[#d7dee6] bg-white">
                  <div className="border-b border-[#d7dee6] bg-[#f8fafc] px-4 py-3 text-[16px] font-bold text-[#22364d]">{"\u0423\u0441\u043b\u043e\u0432\u0438\u044f \u043f\u043e\u0441\u0442\u0430\u0432\u043a\u0438"}</div>
                  <div className="px-4 py-3 text-[14px]">
                    {form.terms.delivery.map((line) => (
                      <div key={line} className="mb-2 last:mb-0">- {line}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[#d7dee6] bg-white">
                  <div className="border-b border-[#d7dee6] bg-[#f8fafc] px-4 py-3 text-[16px] font-bold text-[#22364d]">{"\u0423\u0441\u043b\u043e\u0432\u0438\u044f \u043e\u043f\u043b\u0430\u0442\u044b"}</div>
                  <div className="px-4 py-3 text-[14px]">
                    {form.terms.payment.map((line) => (
                      <div key={line} className="mb-2 last:mb-0">- {line}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[#d7dee6] bg-white">
                  <div className="border-b border-[#d7dee6] bg-[#f8fafc] px-4 py-3 text-[16px] font-bold text-[#22364d]">{"\u0413\u0430\u0440\u0430\u043d\u0442\u0438\u044f"}</div>
                  <div className="px-4 py-3 text-[14px]">
                    {form.terms.warranty.map((line) => (
                      <div key={line} className="mb-2 last:mb-0">- {line}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {form.visibility?.requisitesSection ?? true ? (
              <div className="offer-bank-block mb-10 rounded-[20px] border border-[#d7dee6] bg-[#f8fafc] px-5 py-4 text-[14px] text-[#475569]">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#64748b]">{"\u0411\u0430\u043d\u043a\u043e\u0432\u0441\u043a\u0438\u0435 \u0440\u0435\u043a\u0432\u0438\u0437\u0438\u0442\u044b"}</div>
                <div className="offer-pdf-note whitespace-pre-line">{form.seller.bankDetails}</div>
              </div>
            ) : null}

            <div className="offer-signature-block mb-20 flex items-end justify-between">
              <div className="text-[14px] text-[#64748b]">
                <div>{"\u0421 \u0443\u0432\u0430\u0436\u0435\u043d\u0438\u0435\u043c,"}</div>
                <div>{form.seller.signatureName}</div>
                <div>{form.seller.signatureSubtitle}</div>
              </div>

              <div className="text-[14px] text-[#334155]">{"\u041f\u043e\u0434\u043f\u0438\u0441\u044c: _______________________"}</div>
            </div>

            <div className="flex items-center justify-between border-t border-[#d7dee6] pt-1 text-[12px] text-[#64748b]">
              <div>{"HorecaLink - \u043a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435"}</div>
              <div />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
