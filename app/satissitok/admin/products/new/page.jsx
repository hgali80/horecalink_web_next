"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Save, UploadCloud } from "lucide-react";

import { categoryMap } from "@/app/data/categoryMap";
import { useLang } from "@/app/context/LanguageContext";
import {
  createProduct,
  uploadProductImages,
} from "@/app/satissitok/services/productService";

const BADGE_OPTIONS = [
  { value: "new", labelKey: "product.badges.new", fallback: "Yeni" },
  { value: "best_seller", labelKey: "product.badges.best_seller", fallback: "Cok Satan" },
  { value: "campaign", labelKey: "product.badges.campaign", fallback: "Kampanya" },
  { value: "opportunity", labelKey: "product.badges.opportunity", fallback: "Firsat" },
  { value: "recommended", labelKey: "product.badges.recommended", fallback: "Onerilen" },
  { value: "in_stock", labelKey: "product.badges.in_stock", fallback: "Stokta" },
  { value: "limited_stock", labelKey: "product.badges.limited_stock", fallback: "Sinirli Stok" },
  { value: "project_product", labelKey: "product.badges.project_product", fallback: "Proje Urunu" },
  {
    value: "professional_series",
    labelKey: "product.badges.professional_series",
    fallback: "Profesyonel Seri",
  },
];

const PRODUCT_TYPE_OPTIONS = ["sale_item", "consumable", "service"];
const UNIT_OPTIONS = ["sht", "adet", "kg", "gr", "lt", "ml", "paket", "koli", "set", "pcs"];
const UNIT_TYPE_OPTIONS = ["roll", "piece", "ml", "kg"];

const DEFAULT_HIGHLIGHT_LINES = [
  "Bu urun HoReCa operasyonlarinda yogun kullanim icin uygundur.",
  "Kart bilgileri Firestore katalog verisinden otomatik olusturulur.",
  "Ticari teklif talebinizi tek tikla iletebilirsiniz.",
].join("\n");

const GROUP_OPTIONS = Array.from(
  Object.values(categoryMap).reduce((acc, item) => {
    if (!acc.has(item.groupKey)) {
      acc.set(item.groupKey, { key: item.groupKey, label: item.groupLabel });
    }
    return acc;
  }, new Map()).values()
);

const CATEGORY_OPTIONS = Array.from(
  Object.values(categoryMap).reduce((acc, item) => {
    const compositeKey = `${item.groupKey}__${item.categoryKey}`;
    if (!acc.has(compositeKey)) {
      acc.set(compositeKey, {
        key: item.categoryKey,
        label: item.categoryLabel,
        groupKey: item.groupKey,
      });
    }
    return acc;
  }, new Map()).values()
);

const SUBCATEGORY_OPTIONS = Object.entries(categoryMap).map(([key, item]) => ({
  key,
  label: item.subLabel,
  groupKey: item.groupKey,
  categoryKey: item.categoryKey,
}));

const INITIAL_FORM = {
  stock_code: "",
  sku: "",
  manufacturerCode: "",
  barcode: "",
  badge: "",
  name: "",
  name_tr: "",
  shortDescription: "",
  description: "",
  specs: "",
  highlightLines: DEFAULT_HIGHLIGHT_LINES,
  group: "",
  groupKey: "",
  category: "",
  categoryKey: "",
  subcategory: "",
  subcategoryKey: "",
  main_category: "",
  sub_category: "",
  slug: "",
  searchText: "",
  tags: "",
  binding_codes: "",
  image_names: [],
  imageBase: "",
  brand: "",
  unit: "sht",
  price: 0,
  order: 0,
  sortOrder: 0,
  vatRate: 16,
  productType: "sale_item",
  capacity: "",
  dimensions: "",
  material: "",
  packQty: "",
  caseQty: "",
  unitType: "",
  fuelType: "",
  power: "",
  voltage: "",
  warranty: "",
  weight: "",
  videoUrl: "",
  catalogPdf: "",
  technicalPdf: "",
  popular: "",
  meta: "{}",
  active: true,
  webPublished: false,
  isNew: false,
  stockTracked: true,
  saleEnabled: true,
  purchaseEnabled: true,
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      {children}
    </label>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const { t } = useLang();

  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [uploadInfo, setUploadInfo] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const selectedCategories = useMemo(
    () => CATEGORY_OPTIONS.filter((item) => item.groupKey === form.groupKey),
    [form.groupKey]
  );

  const selectedSubcategories = useMemo(
    () =>
      SUBCATEGORY_OPTIONS.filter(
        (item) =>
          (!form.groupKey || item.groupKey === form.groupKey) &&
          (!form.categoryKey || item.categoryKey === form.categoryKey)
      ),
    [form.categoryKey, form.groupKey]
  );

  function setField(key, value) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  function handleGroupChange(groupKey) {
    const group = GROUP_OPTIONS.find((item) => item.key === groupKey);

    setForm((state) => ({
      ...state,
      groupKey,
      group: group?.label || "",
      category: "",
      categoryKey: "",
      main_category: "",
      subcategory: "",
      subcategoryKey: "",
      sub_category: "",
    }));
  }

  function handleCategoryChange(categoryKey) {
    const category = CATEGORY_OPTIONS.find(
      (item) => item.groupKey === form.groupKey && item.key === categoryKey
    );

    setForm((state) => ({
      ...state,
      categoryKey,
      category: category?.label || "",
      main_category: category?.label || "",
      subcategory: "",
      subcategoryKey: "",
      sub_category: "",
    }));
  }

  function handleSubcategoryChange(subcategoryKey) {
    const subcategory = SUBCATEGORY_OPTIONS.find((item) => item.key === subcategoryKey);

    setForm((state) => ({
      ...state,
      subcategoryKey,
      subcategory: subcategory?.label || "",
      sub_category: subcategory?.label || "",
    }));
  }

  async function onSave() {
    setErr("");
    setUploadInfo(null);

    try {
      setWorking(true);

      const stockCode = String(form.stock_code || "").trim();
      if (!stockCode) throw new Error("stock_code zorunlu.");

      const files = fileRef.current?.files;
      let image_names = Array.isArray(form.image_names) ? form.image_names : [];

      if (files && files.length > 0) {
        const res = await uploadProductImages({
          stockCode,
          files,
          existingImageNames: image_names,
          onProgress: (progress) => setUploadInfo(progress),
        });

        image_names = res.imageNames;
        setField("image_names", image_names);
      }

      const id = await createProduct({
        ...form,
        stock_code: stockCode,
        sku: form.sku || stockCode,
        manufacturerCode: form.manufacturerCode || form.sku || stockCode,
        imageBase: form.imageBase || stockCode,
        slug: form.slug || slugify(form.name_tr || form.name || stockCode),
        sortOrder: form.sortOrder === "" ? form.order : form.sortOrder,
        image_names,
      });

      router.push(`/satissitok/admin/products/${id}`);
    } catch (error) {
      setErr(error?.message || "Kaydetme basarisiz.");
    } finally {
      setWorking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Geri"
          title="Geri"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          aria-label="Satis/Stok Ana Sayfa"
          title="Satis/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Yeni Urun</h1>

        <button
          onClick={onSave}
          disabled={working}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {working ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      {uploadInfo ? (
        <div className="text-xs text-gray-700 border rounded-lg p-3 bg-gray-50">
          <div className="font-semibold flex items-center gap-2">
            <UploadCloud className="w-4 h-4" />
            Foto yukleniyor
          </div>
          <div>
            {uploadInfo.stage === "uploading" ? "Yukleniyor" : "Tamamlandi"}:{" "}
            <b>{uploadInfo.filename}</b> ({uploadInfo.index + 1}/{uploadInfo.total})
          </div>
        </div>
      ) : null}

      <section className="border rounded-xl p-4 space-y-2">
        <div className="font-semibold text-gray-900">Fotograflar</div>
        <div className="text-xs text-gray-600">
          Storage: <b>product_images/</b> • Isim: <b>stock_code.jpg</b>, sonra{" "}
          <b>stock_code-1.jpg</b>, <b>-2</b>...
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="block w-full text-sm"
        />

        {Array.isArray(form.image_names) && form.image_names.length > 0 ? (
          <div className="text-xs text-gray-700">
            <div className="font-semibold mt-2">Mevcut image_names</div>
            <ul className="list-disc pl-5">
              {form.image_names.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-xs text-gray-500">Henuz kaydedilmis foto yok.</div>
        )}
      </section>

      <Section title="Kimlik ve Durum" description="Firestore urun dokumani icin temel alanlar">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Stok Kodu (docId) *">
            <input
              value={form.stock_code}
              onChange={(e) => setField("stock_code", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="111222"
            />
          </Field>

          <Field label="SKU">
            <input
              value={form.sku}
              onChange={(e) => setField("sku", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Bos birakirsan stock_code kullanilir"
            />
          </Field>

          <Field label="Uretici Kodu">
            <input
              value={form.manufacturerCode}
              onChange={(e) => setField("manufacturerCode", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Barkod">
            <input
              value={form.barcode}
              onChange={(e) => setField("barcode", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Rozet (badge)">
            <select
              value={form.badge}
              onChange={(e) => setField("badge", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{t("product.badges.none")}</option>
              {BADGE_OPTIONS.map((badge) => (
                <option key={badge.value} value={badge.value}>
                  {t(badge.labelKey) === badge.labelKey ? badge.fallback : t(badge.labelKey)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Urun Tipi (productType)">
            <select
              value={form.productType}
              onChange={(e) => setField("productType", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {PRODUCT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fiyat">
            <input
              type="number"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="KDV (vatRate)">
            <input
              type="number"
              value={form.vatRate}
              onChange={(e) => setField("vatRate", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Sira (order)">
            <input
              type="number"
              value={form.order}
              onChange={(e) => setField("order", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Liste Sirasi (sortOrder)">
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setField("sortOrder", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Populerlik (popular)">
            <input
              value={form.popular}
              onChange={(e) => setField("popular", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border rounded-xl p-4">
          {[
            ["active", "Aktif"],
            ["webPublished", "Web'de Yayinla"],
            ["isNew", "Yeni Urun"],
            ["saleEnabled", "Satis Aktif"],
            ["purchaseEnabled", "Satinalma Aktif"],
            ["stockTracked", "Stok Takibi"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={(e) => setField(key, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Isim ve Icerik" description="Urun basliklari, aciklama alanlari ve arama verileri">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Urun Adi (RU/KZ) *">
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Urun Adi (TR)">
            <input
              value={form.name_tr}
              onChange={(e) => setField("name_tr", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Kisa Aciklama (shortDescription)">
          <textarea
            value={form.shortDescription}
            onChange={(e) => setField("shortDescription", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
          />
        </Field>

        <Field label="Aciklama (description)">
          <textarea
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[110px]"
          />
        </Field>

        <Field label="Teknik (specs)">
          <textarea
            value={form.specs}
            onChange={(e) => setField("specs", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[110px]"
          />
        </Field>

        <Field label="Detay Sayfasi 3 Satir">
          <textarea
            value={form.highlightLines}
            onChange={(e) => setField("highlightLines", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[110px]"
            placeholder={DEFAULT_HIGHLIGHT_LINES}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Arama Metni (searchText)">
            <textarea
              value={form.searchText}
              onChange={(e) => setField("searchText", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
            />
          </Field>

          <Field label="Etiketler (tags, virgullu)">
            <textarea
              value={form.tags}
              onChange={(e) => setField("tags", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
            />
          </Field>
        </div>

        <Field label="Ilgili Urun Kodlari (binding_codes, virgullu)">
          <input
            value={form.binding_codes}
            onChange={(e) => setField("binding_codes", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="12,51"
          />
        </Field>
      </Section>

      <Section title="Katalog Eslesmesi" description="Secim alanlari categoryMap verisine gore yuklenir">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Grup Anahtari (groupKey)">
            <select
              value={form.groupKey}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seciniz</option>
              {GROUP_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.key})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ana Kategori Anahtari (categoryKey)">
            <select
              value={form.categoryKey}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              disabled={!form.groupKey}
            >
              <option value="">Seciniz</option>
              {selectedCategories.map((option) => (
                <option key={`${option.groupKey}-${option.key}`} value={option.key}>
                  {option.label} ({option.key})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Alt Kategori Anahtari (subcategoryKey)">
            <select
              value={form.subcategoryKey}
              onChange={(e) => handleSubcategoryChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              disabled={!form.categoryKey}
            >
              <option value="">Seciniz</option>
              {selectedSubcategories.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.key})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Grup">
            <input
              value={form.group}
              onChange={(e) => setField("group", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Kategori">
            <input
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Alt Kategori">
            <input
              value={form.subcategory}
              onChange={(e) => setField("subcategory", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="main_category">
            <input
              value={form.main_category}
              onChange={(e) => setField("main_category", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="sub_category">
            <input
              value={form.sub_category}
              onChange={(e) => setField("sub_category", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Slug">
            <input
              value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Bos birakirsan addan otomatik uretilir"
            />
          </Field>
        </div>
      </Section>

      <Section title="Ticari ve Medya Alanlari" description="Birim, marka, dokuman linkleri ve teknik alanlar">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Marka">
            <input
              value={form.brand}
              onChange={(e) => setField("brand", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Birim">
            <select
              value={form.unit}
              onChange={(e) => setField("unit", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seciniz</option>
              {UNIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="imageBase">
            <input
              value={form.imageBase}
              onChange={(e) => setField("imageBase", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Bos birakirsan stock_code kullanilir"
            />
          </Field>

          <Field label="Capacity">
            <input
              value={form.capacity}
              onChange={(e) => setField("capacity", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Dimensions">
            <input
              value={form.dimensions}
              onChange={(e) => setField("dimensions", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Material">
            <input
              value={form.material}
              onChange={(e) => setField("material", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Pack Qty">
            <input
              type="number"
              value={form.packQty}
              onChange={(e) => setField("packQty", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Case Qty">
            <input
              type="number"
              value={form.caseQty}
              onChange={(e) => setField("caseQty", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Unit Type">
            <select
              value={form.unitType}
              onChange={(e) => setField("unitType", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{t("common.select")}</option>
              {UNIT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`productDetail.packaging.unitType.${option}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fuel Type">
            <input
              value={form.fuelType}
              onChange={(e) => setField("fuelType", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Power">
            <input
              value={form.power}
              onChange={(e) => setField("power", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Voltage">
            <input
              value={form.voltage}
              onChange={(e) => setField("voltage", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Warranty">
            <input
              value={form.warranty}
              onChange={(e) => setField("warranty", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Weight">
            <input
              value={form.weight}
              onChange={(e) => setField("weight", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Video URL">
            <input
              value={form.videoUrl}
              onChange={(e) => setField("videoUrl", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Catalog PDF">
            <input
              value={form.catalogPdf}
              onChange={(e) => setField("catalogPdf", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Technical PDF">
            <input
              value={form.technicalPdf}
              onChange={(e) => setField("technicalPdf", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>
        </div>
      </Section>

      <Section title="Meta" description="JSON obje olarak kaydedilir">
        <Field label="meta">
          <textarea
            value={form.meta}
            onChange={(e) => setField("meta", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[130px] font-mono"
          />
        </Field>
      </Section>
    </div>
  );
}
