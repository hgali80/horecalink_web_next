"use client";

import { createElement, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  FileDown,
  ImageOff,
  PlusCircle,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { listProductsAdmin } from "@/app/satissitok/services/productService";
import { getSettings } from "@/app/satissitok/services/settingsService";
import { compareProductsByCategoryOrder } from "@/app/lib/catalog/productSort";
import {
  buildDefaultPresentation,
  buildPresentationItemFromProduct,
  createProductPresentation,
  getProductPresentation,
  getPresentationProductImageUrl,
  saveProductPresentation,
} from "@/app/satissitok/services/productPresentationService";

const PAGE_SIZE = 60;
const LOGO_SRC = "/horecalink_offer_logo_white_v2.png";

function text(value) {
  return String(value ?? "");
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalize(value) {
  return text(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function money(value, currency) {
  const symbols = { KZT: "₸", TRY: "TL", USD: "$", EUR: "€" };
  return `${number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbols[currency] || currency}`;
}

function getPrintableImageSrc(value) {
  const src = text(value).trim();
  if (!src || typeof window === "undefined") return src;
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin === window.location.origin) return url.href;
    if (url.hostname === "firebasestorage.googleapis.com") return `/api/pdf-image?url=${encodeURIComponent(url.href)}`;
  } catch {}
  return src;
}

function ProductImage({ src, alt, className = "" }) {
  const [failedSrc, setFailedSrc] = useState("");
  if (!src || failedSrc === src) {
    return <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}><ImageOff size={22} /></div>;
  }
  return <div className={`relative overflow-hidden ${className}`}><Image src={src} alt={alt} fill unoptimized sizes="(max-width: 768px) 50vw, 240px" onError={() => setFailedSrc(src)} className="object-contain" /></div>;
}

function productCategory(product) {
  return text(product.main_category || product.category || product.categoryKey || "Kategorisiz").trim() || "Kategorisiz";
}

function ProductPicker({ open, products, existingProductIds, onClose, onAdd }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [showSelected, setShowSelected] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);

  const brands = useMemo(() => Array.from(new Set(products.map((item) => text(item.brand).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr")), [products]);
  const categories = useMemo(() => Array.from(new Set(products.map(productCategory))).sort((a, b) => a.localeCompare(b, "tr")), [products]);
  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery);
    return products
      .filter((product) => {
        const id = text(product.id || product.stock_code);
        if (showSelected && !selected.has(id)) return false;
        if (brand && text(product.brand) !== brand) return false;
        if (category && productCategory(product) !== category) return false;
        if (!needle) return true;
        return normalize([product.name, product.name_tr, product.name_ru, product.brand, product.sku, product.stock_code, product.description].join(" ")).includes(needle);
      })
      .sort(compareProductsByCategoryOrder);
  }, [brand, category, deferredQuery, products, selected, showSelected]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, open]);

  if (!open) return null;

  function toggle(product) {
    const id = text(product.id || product.stock_code);
    if (!id || existingProductIds.has(id)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addSelected() {
    const chosen = products.filter((product) => selected.has(text(product.id || product.stock_code)));
    onAdd(chosen);
    setSelected(new Set());
  }

  return (
    <div className="fixed inset-0 z-[100] flex bg-slate-950/60 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label="Sunuma ürün ekle">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Sunuma Ürün Ekle</h2>
              <p className="mt-1 text-sm text-slate-500">Fotoğraflı katalogdan ara, filtrele ve birden fazla ürün seç.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Kapat"><X /></button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 focus-within:border-[#1d3246] focus-within:ring-2 focus-within:ring-[#1d3246]/10">
              <Search size={18} className="text-slate-400" />
              <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Ürün adı, marka veya ürün koduyla ara..." className="w-full py-3 text-sm outline-none" />
            </label>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none">
              <option value="">Tüm kategoriler</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={brand} onChange={(event) => { setBrand(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none">
              <option value="">Tüm markalar</option>
              {brands.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowSelected(false); setVisibleCount(PAGE_SIZE); }} className={`rounded-full px-4 py-2 font-semibold ${!showSelected ? "bg-[#1d3246] text-white" : "bg-slate-100 text-slate-600"}`}>Tüm Ürünler</button>
              <button type="button" onClick={() => { setShowSelected(true); setVisibleCount(PAGE_SIZE); }} className={`rounded-full px-4 py-2 font-semibold ${showSelected ? "bg-[#1d3246] text-white" : "bg-slate-100 text-slate-600"}`}>Seçilenler ({selected.size})</button>
            </div>
            <span className="text-slate-500">{filtered.length.toLocaleString("tr-TR")} ürün bulundu</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
          {filtered.length ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filtered.slice(0, visibleCount).map((product) => {
                  const id = text(product.id || product.stock_code);
                  const isSelected = selected.has(id);
                  const isExisting = existingProductIds.has(id);
                  const image = getPresentationProductImageUrl(product);
                  return (
                    <button key={id} type="button" onClick={() => toggle(product)} disabled={isExisting} className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition ${isExisting ? "cursor-not-allowed border-slate-200 opacity-55" : isSelected ? "border-[#e87524] ring-2 ring-[#e87524]/25" : "border-slate-200 hover:-translate-y-0.5 hover:border-[#1d3246] hover:shadow-md"}`}>
                      <div className="relative aspect-[4/3] bg-white p-3">
                        <ProductImage src={image} alt={product.name || "Ürün"} className="h-full w-full" />
                        <span className={`absolute right-3 top-3 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold shadow ${isExisting ? "bg-slate-600 text-white" : isSelected ? "bg-[#e87524] text-white" : "bg-white text-slate-500"}`}>
                          {isExisting ? "Eklendi" : isSelected ? <Check size={16} /> : "+"}
                        </span>
                      </div>
                      <div className="border-t border-slate-100 p-3">
                        <div className="line-clamp-2 min-h-10 text-sm font-bold text-slate-900">{product.name || product.name_tr || "Ürün"}</div>
                        <div className="mt-2 truncate text-xs font-semibold text-[#e87524]">{product.brand || "Marka belirtilmemiş"}</div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500"><span className="truncate">{product.sku || product.stock_code}</span><span className="font-bold text-slate-800">{money(product.price, "KZT")}</span></div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {visibleCount < filtered.length ? (
                <div className="mt-6 text-center"><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm">Daha Fazla Ürün Göster</button></div>
              ) : null}
            </>
          ) : <div className="flex min-h-64 items-center justify-center text-center text-sm text-slate-500">Arama ve filtrelere uygun ürün bulunamadı.</div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white p-4 md:px-6">
          <strong className="text-sm text-slate-700">{selected.size} ürün seçildi</strong>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Vazgeç</button>
            <button type="button" onClick={addSelected} disabled={!selected.size} className="rounded-xl bg-[#1d3246] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{selected.size} Ürünü Sunuma Ekle</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductPresentationEditor({ presentationId = null }) {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [catalog, settings, saved] = await Promise.all([
          listProductsAdmin(),
          getSettings(),
          presentationId ? getProductPresentation(presentationId) : Promise.resolve(null),
        ]);
        if (!alive) return;
        if (presentationId && !saved) {
          setMessage("Sunum bulunamadı.");
          return;
        }
        setProducts(catalog);
        setUnits((settings.units || []).filter((item) => item.active !== false));
        setForm(saved || buildDefaultPresentation());
      } catch (error) {
        console.error("Product presentation load error:", error);
        if (alive) setMessage("Sunum bilgileri yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [presentationId]);

  const existingProductIds = useMemo(() => new Set((form?.items || []).map((item) => text(item.productId)).filter(Boolean)), [form?.items]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateItem(rowId, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((item) => item.rowId === rowId ? { ...item, [field]: value } : item) }));
  }

  function addProducts(chosen) {
    const additions = chosen.filter((product) => !existingProductIds.has(text(product.id || product.stock_code))).map(buildPresentationItemFromProduct);
    setForm((current) => ({ ...current, items: [...current.items, ...additions] }));
    setPickerOpen(false);
    setMessage(`${additions.length} ürün sunuma eklendi.`);
  }

  function removeItem(rowId) {
    setForm((current) => ({ ...current, items: current.items.filter((item) => item.rowId !== rowId) }));
  }

  function moveItem(index, direction) {
    setForm((current) => {
      const next = [...current.items];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, items: next };
    });
  }

  async function handleSave() {
    if (!form) return;
    if (!form.title.trim()) return setMessage("Admin tarafında ayırt etmek için sunum adı gir.");
    if (!form.items.length) return setMessage("Kaydetmeden önce en az bir ürün ekle.");
    try {
      setSaving(true);
      setMessage("");
      if (presentationId) {
        await saveProductPresentation(presentationId, form);
        setMessage("Sunum kaydedildi.");
      } else {
        const id = await createProductPresentation(form);
        router.replace(`/satissitok/admin/product-presentations/${id}`);
      }
    } catch (error) {
      console.error("Product presentation save error:", error);
      setMessage("Sunum kaydedilemedi. Firestore kurallarının yayınlandığını kontrol et.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePdf() {
    if (!form?.items?.length) return setMessage("PDF oluşturmadan önce ürün ekle.");
    try {
      setSavingPdf(true);
      setMessage("");
      const [{ pdf }, { default: ProductPresentationPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./ProductPresentationPdf"),
      ]);
      const origin = window.location.origin;
      const presentation = {
        ...form,
        items: form.items.map((item) => {
          const src = getPrintableImageSrc(item.imageUrl);
          return { ...item, pdfImageUrl: src ? new URL(src, origin).href : "" };
        }),
      };
      const documentElement = createElement(ProductPresentationPdf, {
        presentation,
        logoUrl: new URL("/pdf/horecalink_logo_white_v2.png", origin).href,
        fontUrl: new URL("/pdf/NotoSans.ttf", origin).href,
      });
      const blob = await pdf(documentElement).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${form.title || "urun-fiyat-sunumu"}.pdf`.replace(/[\\/:*?"<>|]+/g, "-");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Product presentation PDF error:", error);
      setMessage("PDF oluşturulamadı.");
    } finally {
      setSavingPdf(false);
    }
  }

  if (loading || !form) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Yükleniyor...</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/satissitok/admin/product-presentations" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"><ArrowLeft size={16} /> Sunumlar</Link>
          <div><h1 className="text-2xl font-extrabold text-slate-900">{presentationId ? "Ürün Fiyat Sunumunu Düzenle" : "Yeni Ürün Fiyat Sunumu"}</h1><p className="text-sm text-slate-500">Sunum adını müşteri görmez; yalnızca admin listesinde kullanılır.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handlePdf} disabled={savingPdf} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"><FileDown size={17} /> {savingPdf ? "PDF hazırlanıyor..." : "PDF İndir"}</button>
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#1d3246] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={17} /> {saving ? "Kaydediliyor..." : "Kaydet"}</button>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">{message}</div> : null}

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_150px]">
        <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Sunum adı (sadece admin)</span><input value={form.title} onChange={(event) => updateField("title", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1d3246]" /></label>
        <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Durum</span><select value={form.status} onChange={(event) => updateField("status", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="draft">Taslak</option><option value="ready">Hazır</option></select></label>
        <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Para birimi</span><select value={form.currency} onChange={(event) => updateField("currency", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="KZT">KZT (₸)</option><option value="TRY">TRY (TL)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option></select></label>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">Ürünler ({form.items.length})</h2><p className="text-sm text-slate-500">Bilgiler bu sunuma özel değiştirilebilir; ürün kataloğu etkilenmez.</p></div><button type="button" onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#e87524] px-4 py-2.5 text-sm font-bold text-white"><PlusCircle size={18} /> Ürün Ekle</button></div>

        {form.items.length ? (
          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div key={item.rowId} className="grid gap-4 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[120px_minmax(0,1.2fr)_minmax(0,1.5fr)_130px_160px_92px]">
                <ProductImage src={item.imageUrl} alt={item.name || "Ürün"} className="h-28 w-full rounded-xl border border-slate-100" />
                <div className="space-y-3"><label className="block text-xs font-bold text-slate-500">Ürün adı<input value={item.name} onChange={(event) => updateItem(item.rowId, "name", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" /></label><label className="block text-xs font-bold text-slate-500">Marka<input value={item.brand} onChange={(event) => updateItem(item.rowId, "brand", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label></div>
                <label className="block text-xs font-bold text-slate-500">Açıklama<textarea value={item.description} onChange={(event) => updateItem(item.rowId, "description", event.target.value)} rows={5} className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                <label className="block text-xs font-bold text-slate-500">Birim<select value={item.unit} onChange={(event) => updateItem(item.rowId, "unit", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value={item.unit}>{item.unit || "Seç"}</option>{units.filter((unit) => unit.label !== item.unit).map((unit) => <option key={unit.key} value={unit.label}>{unit.label}</option>)}</select></label>
                <label className="block text-xs font-bold text-slate-500">Birim fiyat<div className="mt-1 flex overflow-hidden rounded-lg border border-slate-300"><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.rowId, "unitPrice", number(event.target.value))} className="min-w-0 flex-1 px-3 py-2 text-sm font-bold outline-none" /><span className="border-l border-slate-300 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-500">{form.currency}</span></div></label>
                <div className="flex items-start justify-end gap-1 lg:flex-col"><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-25" aria-label="Yukarı taşı"><ArrowUp size={17} /></button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-25" aria-label="Aşağı taşı"><ArrowDown size={17} /></button><button type="button" onClick={() => removeItem(item.rowId)} className="rounded-lg border border-red-200 p-2 text-red-600" aria-label="Ürünü kaldır"><Trash2 size={17} /></button></div>
              </div>
            ))}
          </div>
        ) : <button type="button" onClick={() => setPickerOpen(true)} className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-[#e87524] hover:text-[#e87524]"><PlusCircle size={30} /><strong className="mt-3">Fotoğraflı katalogdan ürün seç</strong><span className="mt-1 text-sm">Arama ve filtrelerle binlerce ürün içinden hızlıca bul.</span></button>}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
        <div className="flex flex-col items-center bg-[#1d3246] px-6 py-7 text-white"><Image src={LOGO_SRC} alt="HorecaLink" width={220} height={60} unoptimized className="h-14 w-auto object-contain" /><div className="mt-2 text-sm font-semibold">{form.contact?.phone}</div><div className="mt-1 text-sm">{form.contact?.website}</div></div>
        <div className="overflow-x-auto p-4 md:p-6"><table className="w-full min-w-[760px] border-collapse overflow-hidden text-left"><thead><tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><th className="w-36 border border-slate-200 p-3">Fotoğraf</th><th className="border border-slate-200 p-3">Ürün</th><th className="w-32 border border-slate-200 p-3 text-center">Birim</th><th className="w-44 border border-slate-200 p-3 text-right">Birim Fiyat</th></tr></thead><tbody>{form.items.map((item) => <tr key={`preview_${item.rowId}`}><td className="border border-slate-200 p-3"><ProductImage src={item.imageUrl} alt={item.name} className="mx-auto h-24 w-28" /></td><td className="border border-slate-200 p-4 align-top"><div className="font-extrabold text-[#1d3246]">{item.name}</div>{item.brand ? <div className="mt-1 text-sm font-bold text-[#e87524]">{item.brand}</div> : null}{item.description ? <div className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{item.description}</div> : null}</td><td className="border border-slate-200 p-3 text-center text-sm font-semibold">{item.unit}</td><td className="border border-slate-200 p-3 text-right text-sm font-extrabold text-[#1d3246]">{money(item.unitPrice, form.currency)}</td></tr>)}</tbody></table>{!form.items.length ? <div className="py-12 text-center text-sm text-slate-400">Önizlemek için ürün ekle.</div> : null}</div>
      </section>

      <ProductPicker open={pickerOpen} products={products} existingProductIds={existingProductIds} onClose={() => setPickerOpen(false)} onAdd={addProducts} />
    </div>
  );
}
