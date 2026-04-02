// app/satissitok/admin/products/new/page.jsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Save, UploadCloud } from "lucide-react";
import { createProduct, uploadProductImages } from "@/app/satissitok/services/productService";
import { useLang } from "@/app/context/LanguageContext";

const BADGE_OPTIONS = [
  { value: "new", labelKey: "product.badges.new", fallback: "Yeni" },
  { value: "best_seller", labelKey: "product.badges.best_seller", fallback: "Cok Satan" },
  { value: "campaign", labelKey: "product.badges.campaign", fallback: "Kampanya" },
  { value: "opportunity", labelKey: "product.badges.opportunity", fallback: "Firsat" },
  { value: "recommended", labelKey: "product.badges.recommended", fallback: "Onerilen" },
  { value: "in_stock", labelKey: "product.badges.in_stock", fallback: "Stokta" },
  { value: "limited_stock", labelKey: "product.badges.limited_stock", fallback: "Sinirli Stok" },
  { value: "project_product", labelKey: "product.badges.project_product", fallback: "Proje Urunu" },
  { value: "professional_series", labelKey: "product.badges.professional_series", fallback: "Profesyonel Seri" },
];

const DEFAULT_HIGHLIGHT_LINES = [
  "Bu urun HoReCa operasyonlarinda yogun kullanim icin uygundur.",
  "Kart bilgileri Firestore katalog verisinden otomatik olusturulur.",
  "Ticari teklif talebinizi tek tikla iletebilirsiniz.",
].join("\n");

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      {children}
    </label>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const { t } = useLang();

  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [uploadInfo, setUploadInfo] = useState(null);

  const [form, setForm] = useState({
    stock_code: "",
    name: "",
    name_tr: "",
    barcode: "",
    badge: "",
    main_category: "",
    sub_category: "",
    brand: "",
    unit: "шт",
    description: "",
    specs: "",
    highlightLines: DEFAULT_HIGHLIGHT_LINES,
    price: 0,
    order: 0,
    vatRate: 16,
    productType: "sale_item",
    image_names: [],
    binding_codes: "",
    active: true,
    webPublished: false,
    stockTracked: true,
    saleEnabled: true,
    purchaseEnabled: true,
  });

  function set(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSave() {
    setErr("");
    setUploadInfo(null);

    try {
      setWorking(true);

      const stockCode = (form.stock_code || "").toString().trim();
      if (!stockCode) throw new Error("stock_code zorunlu.");

      const files = fileRef.current?.files;
      let image_names = Array.isArray(form.image_names) ? form.image_names : [];

      if (files && files.length > 0) {
        const res = await uploadProductImages({
          stockCode,
          files,
          existingImageNames: image_names,
          onProgress: (p) => setUploadInfo(p),
        });

        image_names = res.imageNames;
        set("image_names", image_names);
      }

      const id = await createProduct({
        ...form,
        stock_code: stockCode,
        image_names,
      });

      router.push(`/satissitok/admin/products/${id}`);
    } catch (e) {
      setErr(e?.message || "Kaydetme başarısız.");
    } finally {
      setWorking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Top Nav */}
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
          aria-label="Satış/Stok Ana Sayfa"
          title="Satış/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Yeni Ürün</h1>

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
            Foto yükleniyor
          </div>
          <div>
            {uploadInfo.stage === "uploading" ? "Yükleniyor" : "Tamamlandı"}:{" "}
            <b>{uploadInfo.filename}</b> ({uploadInfo.index + 1}/{uploadInfo.total})
          </div>
        </div>
      ) : null}

      <section className="border rounded-xl p-4 space-y-2">
        <div className="font-semibold text-gray-900">Fotoğraflar</div>
        <div className="text-xs text-gray-600">
          Storage: <b>product_images/</b> • İsim: <b>stock_code.jpg</b>, sonra{" "}
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
              {form.image_names.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-xs text-gray-500">Henüz kaydedilmiş foto yok.</div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Stok Kodu (docId) *">
          <input
            value={form.stock_code}
            onChange={(e) => set("stock_code", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="111222"
          />
        </Field>

        <Field label="Barkod">
          <input
            value={form.barcode}
            onChange={(e) => set("barcode", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Ürün Adı (RU/KZ) *">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Ürün Adı (TR)">
          <input
            value={form.name_tr}
            onChange={(e) => set("name_tr", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Ana Kategori">
          <input
            value={form.main_category}
            onChange={(e) => set("main_category", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Alt Kategori">
          <input
            value={form.sub_category}
            onChange={(e) => set("sub_category", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Marka">
          <input
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Birim">
          <input
            value={form.unit}
            onChange={(e) => set("unit", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Fiyat">
          <input
            type="number"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Sıra (order)">
          <input
            type="number"
            value={form.order}
            onChange={(e) => set("order", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="KDV (vatRate)">
          <input
            type="number"
            value={form.vatRate}
            onChange={(e) => set("vatRate", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Ürün Tipi (productType)">
          <select
            value={form.productType}
            onChange={(e) => set("productType", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="sale_item">sale_item</option>
            <option value="consumable">consumable</option>
            <option value="service">service</option>
          </select>
        </Field>

        <Field label="İlgili Ürün Kodları (binding_codes) virgüllü">
          <input
            value={form.binding_codes}
            onChange={(e) => set("binding_codes", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="12,51"
          />
        </Field>

        <Field label="Rozet (badge)">
          <select
            value={form.badge}
            onChange={(e) => set("badge", e.target.value)}
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
      </div>

      <Field label="Açıklama (description)">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
        />
      </Field>

      <Field label="Teknik (specs)">
        <textarea
          value={form.specs}
          onChange={(e) => set("specs", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
        />
      </Field>

      <Field label="Detay Sayfasi 3 Satir">
        <textarea
          value={form.highlightLines}
          onChange={(e) => set("highlightLines", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[110px]"
          placeholder={DEFAULT_HIGHLIGHT_LINES}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-xl p-4">
        {[
          ["active", "Aktif"],
          ["webPublished", "Web’de Yayınla"],
          ["saleEnabled", "Satış Aktif"],
          ["purchaseEnabled", "Satınalma Aktif"],
          ["stockTracked", "Stok Takibi"],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form[k]}
              onChange={(e) => set(k, e.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
