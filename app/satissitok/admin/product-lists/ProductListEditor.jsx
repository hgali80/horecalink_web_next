"use client";

import { createElement, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, FileDown, ImageOff, ImagePlus, LoaderCircle, PlusCircle, Save, Search, Trash2, X } from "lucide-react";
import { listProductsAdmin } from "@/app/satissitok/services/productService";
import { getSettings } from "@/app/satissitok/services/settingsService";
import { compareProductsByCategoryOrder } from "@/app/lib/catalog/productSort";
import {
  buildDefaultProductList,
  buildEmptyProductListItem,
  buildProductListItem,
  calculateProductListTotal,
  createProductList,
  getProductList,
  getProductListImageUrl,
  normalizeProductList,
  saveProductList,
  uploadProductListImage,
} from "@/app/satissitok/services/productListService";

const PAGE_SIZE = 60;
const LOGO_SRC = "/horecalink_offer_logo_white_v2.png";

function text(value) { return String(value ?? ""); }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function normalize(value) { return text(value).toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function money(value, currency) {
  const symbols = { KZT: "₸", TRY: "TL", USD: "$", EUR: "€" };
  return `${number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbols[currency] || currency}`;
}
function categoryOf(product) { return text(product.main_category || product.category || product.categoryKey || "Kategorisiz").trim() || "Kategorisiz"; }

function printableImageSrc(value) {
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
  const [failed, setFailed] = useState("");
  if (!src || failed === src) return <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}><ImageOff size={22} /></div>;
  return <div className={`relative overflow-hidden ${className}`}><Image src={src} alt={alt} fill unoptimized sizes="(max-width: 768px) 50vw, 240px" onError={() => setFailed(src)} className="object-contain" /></div>;
}

function ProductPicker({ open, products, existingIds, onClose, onAdd }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);
  const categories = useMemo(() => Array.from(new Set(products.map(categoryOf))).sort((a, b) => a.localeCompare(b, "tr")), [products]);
  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery);
    return products.filter((product) => {
      if (category && categoryOf(product) !== category) return false;
      return !needle || normalize([product.name, product.name_tr, product.name_ru, product.brand, product.sku, product.stock_code].join(" ")).includes(needle);
    }).sort(compareProductsByCategoryOrder);
  }, [category, deferredQuery, products]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    const handleKey = (event) => event.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", handleKey); };
  }, [onClose, open]);

  if (!open) return null;
  function toggle(product) {
    const id = text(product.id || product.stock_code);
    if (!id || existingIds.has(id)) return;
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function addSelected() {
    onAdd(products.filter((product) => selected.has(text(product.id || product.stock_code))));
    setSelected(new Set());
  }

  return (
    <div className="fixed inset-0 z-[100] flex bg-slate-950/60 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label="Listeye ürün ekle">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-4 md:p-6"><div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-xl font-extrabold text-slate-900">Listeye Ürün Ekle</h2><p className="mt-1 text-sm text-slate-500">Katalogdan bir veya birden fazla ürün seç.</p></div><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Kapat"><X /></button></div><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]"><label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 focus-within:border-[#1d3246]"><Search size={18} className="text-slate-400" /><input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Ürün adı, marka veya kod ara..." className="w-full py-3 text-sm outline-none" /></label><select value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"><option value="">Tüm kategoriler</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="mt-3 text-right text-sm text-slate-500">{filtered.length.toLocaleString("tr-TR")} ürün</div></div>
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{filtered.slice(0, visibleCount).map((product) => { const id = text(product.id || product.stock_code); const chosen = selected.has(id); const existing = existingIds.has(id); return <button key={id} type="button" disabled={existing} onClick={() => toggle(product)} className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition ${existing ? "cursor-not-allowed opacity-45" : chosen ? "border-[#e87524] ring-2 ring-[#e87524]/25" : "border-slate-200 hover:border-[#1d3246]"}`}><div className="relative aspect-[4/3] p-3"><ProductImage src={getProductListImageUrl(product)} alt={product.name || "Ürün"} className="h-full w-full" /><span className={`absolute right-3 top-3 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold shadow ${existing ? "bg-slate-600 text-white" : chosen ? "bg-[#e87524] text-white" : "bg-white text-slate-500"}`}>{existing ? "Eklendi" : chosen ? <Check size={16} /> : "+"}</span></div><div className="border-t border-slate-100 p-3"><div className="line-clamp-2 min-h-10 text-sm font-bold text-slate-900">{product.name || product.name_ru || product.name_tr || "Ürün"}</div><div className="mt-2 truncate text-xs font-semibold text-[#e87524]">{product.brand || "Marka belirtilmemiş"}</div></div></button>; })}</div>{visibleCount < filtered.length ? <div className="mt-6 text-center"><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold">Daha Fazla Göster</button></div> : null}</div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 md:px-6"><strong className="text-sm text-slate-700">{selected.size} ürün seçildi</strong><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">Vazgeç</button><button type="button" onClick={addSelected} disabled={!selected.size} className="rounded-xl bg-[#1d3246] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">Listeye Ekle</button></div></div>
      </div>
    </div>
  );
}

export default function ProductListEditor({ listId = null }) {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadingRows, setUploadingRows] = useState(() => new Set());
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [catalog, settings, saved] = await Promise.all([listProductsAdmin(), getSettings(), listId ? getProductList(listId) : Promise.resolve(null)]);
        if (!alive) return;
        if (listId && !saved) { setMessage("Ürün listesi bulunamadı."); return; }
        setProducts(catalog);
        setUnits((settings.units || []).filter((item) => item.active !== false));
        setForm(normalizeProductList(saved || buildDefaultProductList()));
      } catch (error) {
        console.error("Product list load error:", error);
        if (alive) setMessage("Ürün listesi yüklenemedi.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [listId]);

  const existingIds = useMemo(() => new Set((form?.items || []).map((item) => text(item.productId)).filter(Boolean)), [form?.items]);
  const grandTotal = useMemo(() => calculateProductListTotal(form?.items), [form?.items]);
  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function updateItem(rowId, field, value) { setForm((current) => ({ ...current, items: current.items.map((item) => item.rowId === rowId ? { ...item, [field]: value } : item) })); }
  function addProducts(chosen) { const additions = chosen.filter((product) => !existingIds.has(text(product.id || product.stock_code))).map(buildProductListItem); setForm((current) => ({ ...current, items: [...current.items, ...additions] })); setPickerOpen(false); setMessage(`${additions.length} ürün eklendi.`); }
  function addEmptyProduct() {
    const defaultUnit = units.find((unit) => unit.default)?.label || units[0]?.label || "шт";
    setForm((current) => ({ ...current, items: [...current.items, buildEmptyProductListItem(defaultUnit)] }));
    setMessage("Boş ürün kartı eklendi. Bilgileri ve görseli bu listeye özel doldurabilirsin.");
  }
  async function handleItemImage(rowId, file) {
    if (!file) return;
    const previousUrl = form.items.find((item) => item.rowId === rowId)?.imageUrl || "";
    const previewUrl = URL.createObjectURL(file);
    updateItem(rowId, "imageUrl", previewUrl);
    setUploadingRows((current) => new Set(current).add(rowId));
    setMessage("");
    try {
      const uploaded = await uploadProductListImage({ storageKey: form.storageKey, rowId, file });
      setForm((current) => ({
        ...current,
        items: current.items.map((item) => item.rowId === rowId ? { ...item, ...uploaded } : item),
      }));
      setMessage("Ürün görseli yüklendi.");
    } catch (error) {
      console.error("Product list image upload error:", error);
      updateItem(rowId, "imageUrl", previousUrl);
      setMessage(error?.message || "Görsel yüklenemedi.");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingRows((current) => { const next = new Set(current); next.delete(rowId); return next; });
    }
  }
  function removeItem(rowId) { setForm((current) => ({ ...current, items: current.items.filter((item) => item.rowId !== rowId) })); }
  function moveItem(index, direction) { setForm((current) => { const items = [...current.items]; const target = index + direction; if (target < 0 || target >= items.length) return current; [items[index], items[target]] = [items[target], items[index]]; return { ...current, items }; }); }

  function validate() {
    if (!form.title.trim()) return "Admin listesi için bir kayıt adı gir.";
    if (!form.customerName.trim()) return "Müşteri adı zorunludur.";
    if (!form.items.length) return "En az bir ürün ekle.";
    if (form.items.some((item) => !text(item.name).trim())) return "Tüm ürün kartlarına ürün adı gir.";
    if (uploadingRows.size) return "Görsel yüklemesinin tamamlanmasını bekle.";
    return "";
  }

  async function handleSave() {
    const problem = validate(); if (problem) return setMessage(problem);
    try {
      setSaving(true); setMessage("");
      const payload = { ...form };
      delete payload.id;
      if (listId) { await saveProductList(listId, payload); setMessage("Ürün listesi kaydedildi."); }
      else { const newId = await createProductList(payload); router.replace(`/satissitok/admin/product-lists/${newId}`); }
    } catch (error) { console.error("Product list save error:", error); setMessage("Liste kaydedilemedi. Firestore kurallarını kontrol et."); }
    finally { setSaving(false); }
  }

  async function handlePdf() {
    const problem = validate(); if (problem) return setMessage(problem);
    try {
      setSavingPdf(true); setMessage("");
      const [{ pdf }, { default: ProductListPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./ProductListPdf")]);
      const origin = window.location.origin;
      const productList = { ...form, items: form.items.map((item) => { const src = printableImageSrc(item.imageUrl); return { ...item, pdfImageUrl: src ? new URL(src, origin).href : "" }; }) };
      const element = createElement(ProductListPdf, { productList, logoUrl: new URL("/pdf/horecalink_logo_white_v2.png", origin).href, fontUrl: new URL("/pdf/NotoSans.ttf", origin).href });
      const blob = await pdf(element).toBlob();
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${form.title || "spisok-tovar"}.pdf`.replace(/[\\/:*?"<>|]+/g, "-"); document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { console.error("Product list PDF error:", error); setMessage("PDF oluşturulamadı."); }
    finally { setSavingPdf(false); }
  }

  if (loading || !form) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Yükleniyor...</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/satissitok/admin/product-lists" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"><ArrowLeft size={16} /> Listeler</Link><div><h1 className="text-2xl font-extrabold text-slate-900">{listId ? "Spisok Tovar Düzenle" : "Yeni Spisok Tovar"}</h1><p className="text-sm text-slate-500">Müşteriye özel fotoğraflı ürün listesi.</p></div></div><div className="flex gap-2"><button type="button" onClick={handlePdf} disabled={savingPdf} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"><FileDown size={17} /> {savingPdf ? "Hazırlanıyor..." : "PDF İndir"}</button><button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#1d3246] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={17} /> {saving ? "Kaydediliyor..." : "Kaydet"}</button></div></div>
      {message ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">{message}</div> : null}

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_180px_150px]">
        <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Kayıt adı (sadece admin)</span><input value={form.title} onChange={(event) => updateField("title", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none" /></label>
        <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Müşteri adı</span><input value={form.customerName} onChange={(event) => updateField("customerName", event.target.value)} placeholder="Müşteri veya firma adı" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none" /></label>
        <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Durum</span><select value={form.status} onChange={(event) => updateField("status", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="draft">Taslak</option><option value="ready">Hazır</option></select></label>
        <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Para birimi</span><select value={form.currency} onChange={(event) => updateField("currency", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="KZT">KZT (₸)</option><option value="TRY">TRY (TL)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option></select></label>
        <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tarih</span><input type="date" value={form.issueDate} onChange={(event) => updateField("issueDate", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none" /></label>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">Ürünler ({form.items.length})</h2><p className="text-sm text-slate-500">Katalogdan seçebilir veya web sitesinde olmayan bir ürün için boş kart açabilirsin.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={addEmptyProduct} className="inline-flex items-center gap-2 rounded-xl border border-[#1d3246] bg-white px-4 py-2.5 text-sm font-bold text-[#1d3246]"><ImagePlus size={18} /> Boş Ürün Kartı</button><button type="button" onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#e87524] px-4 py-2.5 text-sm font-bold text-white"><PlusCircle size={18} /> Katalogdan Ürün</button></div></div>
        {form.items.length ? <div className="space-y-3">{form.items.map((item, index) => <div key={item.rowId} className="grid gap-4 rounded-2xl border border-slate-200 p-4 xl:grid-cols-[120px_minmax(0,1.1fr)_minmax(0,1.3fr)_90px_115px_160px_92px]"><div className="space-y-2"><ProductImage src={item.imageUrl} alt={item.name || "Ürün"} className="h-28 w-full rounded-xl border border-slate-100" /><label className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-bold transition ${uploadingRows.has(item.rowId) ? "cursor-wait border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 bg-white text-slate-700 hover:border-[#e87524] hover:text-[#e87524]"}`}>{uploadingRows.has(item.rowId) ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}{uploadingRows.has(item.rowId) ? "Yükleniyor" : item.imageUrl ? "Görseli Değiştir" : "Görsel Seç"}<input type="file" accept="image/*" disabled={uploadingRows.has(item.rowId)} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; handleItemImage(item.rowId, file); }} className="sr-only" /></label></div><div className="space-y-3"><label className="block text-xs font-bold text-slate-500">Ürün adı<input value={item.name} onChange={(event) => updateItem(item.rowId, "name", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" /></label><label className="block text-xs font-bold text-slate-500">Marka<input value={item.brand} onChange={(event) => updateItem(item.rowId, "brand", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label></div><label className="block text-xs font-bold text-slate-500">Açıklama<textarea value={item.description} onChange={(event) => updateItem(item.rowId, "description", event.target.value)} rows={5} className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-xs font-bold text-slate-500">Miktar<input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(item.rowId, "quantity", Math.max(0, number(event.target.value)))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold" /></label><label className="block text-xs font-bold text-slate-500">Birim<select value={item.unit} onChange={(event) => updateItem(item.rowId, "unit", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value={item.unit}>{item.unit || "Seç"}</option>{units.filter((unit) => unit.label !== item.unit).map((unit) => <option key={unit.key} value={unit.label}>{unit.label}</option>)}</select></label><div><label className="block text-xs font-bold text-slate-500">Birim fiyat<div className="mt-1 flex overflow-hidden rounded-lg border border-slate-300"><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.rowId, "unitPrice", Math.max(0, number(event.target.value)))} className="min-w-0 flex-1 px-3 py-2 text-sm font-bold outline-none" /><span className="border-l border-slate-300 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-500">{form.currency}</span></div></label><div className="mt-3 rounded-lg bg-slate-100 px-3 py-2"><div className="text-[10px] font-bold uppercase text-slate-500">Toplam</div><div className="mt-1 text-sm font-extrabold text-[#1d3246]">{money(number(item.quantity) * number(item.unitPrice), form.currency)}</div></div></div><div className="flex items-start justify-end gap-1 xl:flex-col"><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-25" aria-label="Yukarı taşı"><ArrowUp size={17} /></button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-25" aria-label="Aşağı taşı"><ArrowDown size={17} /></button><button type="button" onClick={() => removeItem(item.rowId)} className="rounded-lg border border-red-200 p-2 text-red-600" aria-label="Kaldır"><Trash2 size={17} /></button></div></div>)}</div> : <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={addEmptyProduct} className="flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-[#1d3246] hover:text-[#1d3246]"><ImagePlus size={30} /><strong className="mt-3">Boş ürün kartı ekle</strong><span className="mt-1 text-xs">Web sitesinde olmayan ürün için</span></button><button type="button" onClick={() => setPickerOpen(true)} className="flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-[#e87524] hover:text-[#e87524]"><PlusCircle size={30} /><strong className="mt-3">Katalogdan ürün seç</strong></button></div>}
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]"><label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Not (isteğe bağlı)</span><textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} rows={4} placeholder="Ürünlerle ilgili kısa not..." className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none" /></label><div className="flex flex-col justify-center rounded-2xl bg-[#1d3246] p-5 text-white"><span className="text-xs font-bold uppercase tracking-[0.16em] text-white/65">Genel toplam</span><strong className="mt-2 text-2xl">{money(grandTotal, form.currency)}</strong></div></section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg"><div className="flex flex-col items-center bg-[#1d3246] px-6 py-7 text-white"><Image src={LOGO_SRC} alt="HorecaLink" width={220} height={60} unoptimized className="h-14 w-auto object-contain" /></div><div className="border-b border-slate-200 px-6 py-5"><div className="text-center text-xl font-black tracking-[0.14em] text-[#1d3246]">СПИСОК ТОВАРОВ</div><div className="mt-4 flex flex-wrap justify-between gap-3 text-sm"><span><strong>КЛИЕНТ:</strong> {form.customerName || "—"}</span><span><strong>ДАТА:</strong> {form.issueDate ? new Date(`${form.issueDate}T00:00:00`).toLocaleDateString("ru-RU") : "—"}</span></div></div><div className="overflow-x-auto p-4 md:p-6"><table className="w-full min-w-[980px] border-collapse text-left"><thead><tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><th className="w-32 border border-slate-200 p-3">Фото</th><th className="border border-slate-200 p-3">Товар</th><th className="w-24 border border-slate-200 p-3 text-center">Кол-во</th><th className="w-24 border border-slate-200 p-3 text-center">Ед.</th><th className="w-36 border border-slate-200 p-3 text-right">Цена</th><th className="w-40 border border-slate-200 p-3 text-right">Сумма</th></tr></thead><tbody>{form.items.map((item) => <tr key={`preview_${item.rowId}`}><td className="border border-slate-200 p-3"><ProductImage src={item.imageUrl} alt={item.name} className="mx-auto h-24 w-28" /></td><td className="border border-slate-200 p-4 align-top"><div className="font-extrabold text-[#1d3246]">{item.name}</div>{item.brand ? <div className="mt-1 text-sm font-bold text-[#e87524]">{item.brand}</div> : null}{item.description ? <div className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{item.description}</div> : null}</td><td className="border border-slate-200 p-3 text-center text-sm font-semibold">{number(item.quantity).toLocaleString("tr-TR")}</td><td className="border border-slate-200 p-3 text-center text-sm font-semibold">{item.unit}</td><td className="border border-slate-200 p-3 text-right text-sm font-bold">{money(item.unitPrice, form.currency)}</td><td className="border border-slate-200 p-3 text-right text-sm font-extrabold">{money(number(item.quantity) * number(item.unitPrice), form.currency)}</td></tr>)}</tbody></table><div className="ml-auto mt-4 w-full max-w-sm rounded-2xl bg-[#1d3246] p-5 text-white"><div className="text-xs font-bold uppercase tracking-wider text-white/65">Итого</div><div className="mt-2 text-2xl font-black">{money(grandTotal, form.currency)}</div></div>{form.note ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase text-slate-500">Примечание</div><div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{form.note}</div></div> : null}</div></section>
      <ProductPicker open={pickerOpen} products={products} existingIds={existingIds} onClose={() => setPickerOpen(false)} onAdd={addProducts} />
    </div>
  );
}
