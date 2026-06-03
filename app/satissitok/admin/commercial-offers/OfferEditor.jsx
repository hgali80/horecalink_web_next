"use client";

import { useEffect, useMemo, useState } from "react";
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
  getCommercialOffer,
  getNextCommercialOfferMeta,
  saveCommercialOffer,
} from "@/app/satissitok/services/commercialOfferService";

const LOGO_SRC = "/horecalink_offer_logo.png";

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

function splitLines(value) {
  return text(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
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

export default function OfferEditor({ offerId = null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [products, setProducts] = useState([]);
  const [caris, setCaris] = useState([]);
  const [units, setUnits] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const [settings, productList, cariList, existingOffer, nextMeta] = await Promise.all([
          getSettings(),
          listProductsAdmin(),
          listCaris(),
          offerId ? getCommercialOffer(offerId) : Promise.resolve(null),
          offerId ? Promise.resolve(null) : getNextCommercialOfferMeta(),
        ]);

        if (!alive) return;

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
          });
        } else {
          setForm(
            buildDefaultOfferPayload({
              offerNo: nextMeta?.offerNo || "",
              sequence: nextMeta?.sequence || 0,
              units: settings.units || [],
              vatRate: defaultVatRate,
            })
          );
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
  }, [offerId]);

  const defaultUnit = useMemo(
    () => units.find((item) => item.default)?.label || units[0]?.label || "шт",
    [units]
  );

  const calculated = useMemo(() => {
    if (!form) return { items: [], totals: { grandTotal: 0, vatAmount: 0, vatRate: 12 } };
    return calculateOfferTotals(form.items || [], form.vatRate || 12);
  }, [form]);

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
        const newId = await createCommercialOffer(payload);
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

  function handlePrint() {
    if (!form) return;
    const previousTitle = document.title;
    document.title = form.offerNo || "HorecaLink";
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 300);
  }

  async function handleSavePdf() {
    if (!form || !pdfContentRef.current) return;

    let wrapper = null;

    try {
      setSavingPdf(true);
      setMessage("");

      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const clone = pdfContentRef.current.cloneNode(true);
      wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-100000px";
      wrapper.style.top = "0";
      wrapper.style.width = "1000px";
      wrapper.style.background = "#ffffff";
      wrapper.style.zIndex = "-1";
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      await html2pdf()
        .set({
          margin: 0,
          filename: `${form.offerNo || "HorecaLink-teklif"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
          },
        })
        .from(clone)
        .save();
    } catch (error) {
      console.error("Commercial offer pdf error:", error);
      setMessage("PDF oluşturulamadı.");
    } finally {
      if (wrapper?.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
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
                onClick={handlePrint}
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
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">Toplamlar</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-500">Genel Toplam</span>
                    <span className="text-lg font-bold text-slate-900">{formatMoney(calculated.totals.grandTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-500">KDV %{form.vatRate}</span>
                    <span className="font-bold text-slate-900">{formatMoney(calculated.totals.vatAmount)}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="offer-print hidden bg-white text-[#2b2f33]">
          <div className="mx-auto w-[1000px] px-3 py-4 text-[13px] leading-[1.35]">
            <div className="mb-5 ml-[28px] mr-[18px] h-[22px] bg-[linear-gradient(to_right,#f6a400_0,#f6a400_16%,#24384d_16%,#24384d_100%)]" />

            <div className="mb-6 grid grid-cols-[1.06fr_0.94fr] items-start gap-8">
              <div className="pt-0">
                <div className="mb-1 h-[165px] w-[520px] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={LOGO_SRC} alt="HorecaLink" className="ml-[-18px] mt-[-56px] h-[310px] w-[520px] max-w-none object-cover object-center" />
                </div>
                <div className="text-[22px] font-extrabold leading-none text-[#22364d]">{form.seller.brandName}</div>
                <div className="mt-2 max-w-[430px] text-[16px] leading-[1.18] text-[#64748b]">{form.seller.tagline}</div>
                <div className="mt-3 text-[14px] font-semibold text-[#22364d]">www.horecalink.kz</div>
              </div>

              <div className="mt-[16px] ml-auto w-[445px] border-[2px] border-[#6f8192]">
                <div className="border-b border-[#cfd7df] bg-[#eef2f5] px-4 py-[9px] text-[17px] font-extrabold uppercase tracking-[0.015em] text-[#2f3337]">
                  Коммерческое предложение
                </div>
                <div className="flex min-h-[126px] flex-col items-end justify-between px-5 py-4 text-right">
                  <div className="mb-3 text-right text-[20px] font-bold text-[#2f3337]">№ {form.offerNo}</div>
                  <div className="mb-4 text-right text-[16px] text-[#2f3337]">от {formatDateLabel(form.issueDate)} г.</div>
                  <div className="text-right text-[16px] text-[#2f3337]">Срок действия: {form.validDays} календарных дней</div>
                </div>
              </div>
            </div>

            <div className="mb-5 text-center text-[#22364d]">
              <div className="text-[32px] font-extrabold uppercase">Коммерческое предложение</div>
              <div className="text-[30px] font-extrabold">{"\u043d\u0430 \u0438\u0437\u0433\u043e\u0442\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0438\u0437\u0434\u0435\u043b\u0438\u0439 \u0438\u0437 \u043d\u0435\u0440\u0436\u0430\u0432\u0435\u044e\u0449\u0435\u0439 \u0441\u0442\u0430\u043b\u0438"}</div>
            </div>

            <div className="mb-5 grid grid-cols-2 border border-[#d7dee6]">
              <div className="border-r border-[#d7dee6] p-3 text-[15px]">
                <div className="mb-1 text-[18px]">Исполнитель:</div>
                <div>{form.seller.brandName}</div>
                <div>Производство и оформление:</div>
                <div>{form.seller.companyName}</div>
                <div>БИН: {form.seller.bin}</div>
                <div>{form.seller.address}</div>
              </div>
              <div className="p-3 text-[15px]">
                <div className="mb-1 text-[18px]">Покупатель:</div>
                <div>{form.buyer.companyName || "________________"}</div>
                <div>БИН/ИИН: {form.buyer.bin || "________________"}</div>
                <div>{form.buyer.address || "________________"}</div>
              </div>
            </div>

            <div className="mb-6 text-[14px]">
              <div className="mb-1">Добрый день,</div>
              <div>{form.introText}</div>
            </div>

            <table className="mb-4 w-full border-collapse text-[13px]">
              <colgroup>
                <col style={{ width: "28px" }} />
                <col style={{ width: "96px" }} />
                <col style={{ width: "155px" }} />
                <col />
                <col style={{ width: "56px" }} />
                <col style={{ width: "96px" }} />
                <col style={{ width: "116px" }} />
              </colgroup>
              <thead>
                <tr className="bg-[#22364d] text-white">
                  <th className="border border-[#cfd7df] px-2 py-3">№</th>
                  <th className="border border-[#cfd7df] px-2 py-3">Фото</th>
                  <th className="border border-[#cfd7df] px-2 py-3">Наименование</th>
                  <th className="border border-[#cfd7df] px-2 py-3">Характеристики</th>
                  <th className="border border-[#cfd7df] px-2 py-3">Кол-во</th>
                  <th className="border border-[#cfd7df] px-2 py-3">Цена</th>
                  <th className="border border-[#cfd7df] px-2 py-3">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {calculated.items.map((item, index) => (
                  <tr key={item.rowId}>
                    <td className="border border-[#d7dee6] px-2 py-3 align-middle">{index + 1}</td>
                    <td className="border border-[#d7dee6] px-2 py-3 align-middle">
                      <div className="flex items-center justify-center">
                        <ProductImage src={item.imageUrl} alt={item.name || "Product"} sizeClass="w-[74px]" />
                      </div>
                    </td>
                    <td className="border border-[#d7dee6] px-2 py-3 align-middle text-[14px] leading-[1.2]">{item.name}</td>
                    <td className="border border-[#d7dee6] px-2 py-3 align-middle whitespace-pre-line text-[14px]">
                      {item.description}
                    </td>
                    <td className="border border-[#d7dee6] px-2 py-3 align-middle whitespace-nowrap text-[14px]">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="border border-[#d7dee6] px-2 py-3 align-middle whitespace-nowrap text-[14px]">{formatMoney(item.unitPrice)}</td>
                    <td className="border border-[#d7dee6] px-2 py-3 align-middle whitespace-nowrap text-[16px] font-bold">{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mb-10 flex justify-end">
              <div className="w-[440px]">
                <div className="flex items-center justify-between text-[20px] font-bold">
                  <span>Итого:</span>
                  <span>{formatMoney(calculated.totals.grandTotal)}</span>
                </div>
                <div className="mt-1 text-right text-[15px]">
                  <span>{`В том числе НДС ${form.vatRate}%: ${formatMoney(calculated.totals.vatAmount)}`}</span>
                </div>
              </div>
            </div>

            <div className="avoid-break mb-6 grid grid-cols-3 border border-[#d7dee6]">
              <div className="border-r border-[#d7dee6]">
                <div className="border-b border-[#d7dee6] bg-[#f8fafc] px-3 py-2 text-[18px] font-bold text-[#22364d]">Условия поставки</div>
                <div className="px-3 py-2 text-[14px]">
                  {form.terms.delivery.map((line) => (
                    <div key={line}>- {line}</div>
                  ))}
                </div>
              </div>
              <div className="border-r border-[#d7dee6]">
                <div className="border-b border-[#d7dee6] bg-[#f8fafc] px-3 py-2 text-[18px] font-bold text-[#22364d]">Условия оплаты</div>
                <div className="px-3 py-2 text-[14px]">
                  {form.terms.payment.map((line) => (
                    <div key={line}>- {line}</div>
                  ))}
                </div>
              </div>
              <div>
                <div className="border-b border-[#d7dee6] bg-[#f8fafc] px-3 py-2 text-[18px] font-bold text-[#22364d]">Гарантия</div>
                <div className="px-3 py-2 text-[14px]">
                  {form.terms.warranty.map((line) => (
                    <div key={line}>- {line}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-10 text-[14px] text-[#64748b]">{form.seller.bankDetails}</div>

            <div className="mb-20 flex items-end justify-between">
              <div className="text-[14px] text-[#64748b]">
                <div>С уважением,</div>
                <div>{form.seller.signatureName}</div>
                <div>{form.seller.signatureSubtitle}</div>
              </div>

              <div className="text-[14px] text-[#334155]">Подпись: _______________________</div>
            </div>

            <div className="flex items-center justify-between border-t border-[#d7dee6] pt-1 text-[12px] text-[#64748b]">
              <div>HorecaLink - коммерческое предложение</div>
              <div>стр. 1</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
