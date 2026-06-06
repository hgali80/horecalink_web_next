"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Home,
  Save,
  UploadCloud,
} from "lucide-react";
import { ref, getDownloadURL, listAll } from "firebase/storage";

import { storage } from "@/firebase";
import { useLang } from "@/app/context/LanguageContext";
import {
  getProduct,
  updateProduct,
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
  { value: "professional_series", labelKey: "product.badges.professional_series", fallback: "Profesyonel Seri" },
];

const UNIT_TYPE_OPTIONS = ["roll", "piece", "ml", "kg"];

const LEGACY_BADGE_ALIASES = {
  Yeni: "new",
  "Cok Satan": "best_seller",
  Kampanya: "campaign",
  Firsat: "opportunity",
  Onerilen: "recommended",
  Stokta: "in_stock",
  "Sinirli Stok": "limited_stock",
  "Proje Urunu": "project_product",
  "Profesyonel Seri": "professional_series",
};

function normalizeBadgeValue(value) {
  const clean = (value || "").toString().trim();
  return LEGACY_BADGE_ALIASES[clean] || clean;
}

const DEFAULT_HIGHLIGHT_LINES = [
  "Bu urun HoReCa operasyonlarinda yogun kullanim icin uygundur.",
  "Kart bilgileri Firestore katalog verisinden otomatik olusturulur.",
  "Ticari teklif talebinizi tek tikla iletebilirsiniz.",
].join("\n");

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-gray-700">{label}</div>
        {hint ? <div className="text-[11px] text-gray-400">{hint}</div> : null}
      </div>
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

function stringifyMeta(value) {
  try {
    return JSON.stringify(value && typeof value === "object" ? value : {}, null, 2);
  } catch {
    return "{}";
  }
}

function cleanText(value) {
  return (value ?? "").toString().trim();
}

function ensureImageExtension(value) {
  const text = cleanText(value);
  if (!text) return "";
  return /\.[a-z0-9]+$/i.test(text) ? text : `${text}.jpg`;
}

function toImageStem(value) {
  return ensureImageExtension(value).replace(/\.[a-z0-9]+$/i, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getImageSortOrder(filename, stem) {
  const exactPattern = new RegExp(`^${escapeRegex(stem)}\\.[a-z0-9]+$`, "i");
  if (exactPattern.test(filename)) return 0;

  const numberedMatch = filename.match(
    new RegExp(`^${escapeRegex(stem)}-(\\d+)\\.[a-z0-9]+$`, "i")
  );

  if (!numberedMatch) return Number.MAX_SAFE_INTEGER;
  return Number(numberedMatch[1]);
}

function sortImageNamesByStem(names, stems) {
  const preferredStem = stems.find(Boolean) || "";

  return [...names].sort((a, b) => {
    const aOrder = getImageSortOrder(a, preferredStem);
    const bOrder = getImageSortOrder(b, preferredStem);

    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b, "tr");
  });
}

function getCandidateImageStems(form, productId) {
  return Array.from(
    new Set(
      [
        productId,
        form?.stock_code,
        form?.sku,
        form?.manufacturerCode,
        form?.imageBase,
        form?.id,
      ]
        .map((value) => toImageStem(value))
        .filter(Boolean)
    )
  );
}

function buildInitialForm(product) {
  return {
    id: product.id ?? "",
    stock_code: product.stock_code ?? product.sku ?? product.id ?? "",
    sku: product.sku ?? product.stock_code ?? product.id ?? "",
    manufacturerCode: product.manufacturerCode ?? product.sku ?? product.id ?? "",
    barcode: product.barcode ?? "",
    badge: normalizeBadgeValue(product.badge),
    name: product.name ?? "",
    name_tr: product.name_tr ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    specs: product.specs ?? "",
    highlightLines: product.highlightLines ?? DEFAULT_HIGHLIGHT_LINES,
    group: product.group ?? "",
    groupKey: product.groupKey ?? "",
    category: product.category ?? product.main_category ?? "",
    categoryKey: product.categoryKey ?? product.main_category ?? "",
    subcategory: product.subcategory ?? product.sub_category ?? "",
    subcategoryKey: product.subcategoryKey ?? product.sub_category ?? "",
    main_category: product.main_category ?? product.categoryKey ?? product.category ?? "",
    sub_category: product.sub_category ?? product.subcategoryKey ?? product.subcategory ?? "",
    slug: product.slug ?? "",
    searchText: product.searchText ?? "",
    tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
    binding_codes: Array.isArray(product.binding_codes)
      ? product.binding_codes.join(",")
      : (product.binding_codes ?? ""),
    image_names: Array.isArray(product.image_names) ? product.image_names : [],
    imageBase: product.imageBase ?? product.sku ?? "",
    brand: product.brand ?? "",
    unit: product.unit ?? "",
    price: product.price ?? 0,
    order: product.order ?? product.sortOrder ?? 0,
    sortOrder: product.sortOrder ?? product.order ?? 0,
    vatRate: product.vatRate ?? 16,
    productType: product.productType ?? "sale_item",
    capacity: product.capacity ?? "",
    dimensions: product.dimensions ?? "",
    material: product.material ?? "",
    packQty: product.packQty ?? "",
    caseQty: product.caseQty ?? "",
    unitType: product.unitType ?? "",
    fuelType: product.fuelType ?? "",
    power: product.power ?? "",
    voltage: product.voltage ?? "",
    warranty: product.warranty ?? "",
    weight: product.weight ?? "",
    videoUrl: product.videoUrl ?? "",
    catalogPdf: product.catalogPdf ?? "",
    technicalPdf: product.technicalPdf ?? "",
    popular: product.popular ?? "",
    active: product.active ?? true,
    webPublished: product.webPublished ?? false,
    isNew: product.isNew ?? false,
    stockTracked: product.stockTracked ?? true,
    saleEnabled: product.saleEnabled ?? true,
    purchaseEnabled: product.purchaseEnabled ?? true,
    meta: stringifyMeta(product.meta),
    createdAt: product.createdAt ?? "",
    updatedAt: product.updatedAt ?? "",
  };
}

export default function ProductDetailEditPage() {
  const { productId } = useParams();
  const router = useRouter();
  const fileRef = useRef(null);
  const { t } = useLang();

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const formId = form?.id;
  const formImageBase = form?.imageBase;
  const formImageNames = form?.image_names;
  const formManufacturerCode = form?.manufacturerCode;
  const formSku = form?.sku;
  const formStockCode = form?.stock_code;

  function set(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const product = await getProduct(productId);

        if (!alive) return;

        if (!product) {
          setErr("Ürün bulunamadı.");
          return;
        }

        setForm(buildInitialForm(product));
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Yükleme hatası.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [productId]);

  useEffect(() => {
    let alive = true;

    async function loadPreviewUrls() {
      const names = Array.isArray(formImageNames)
        ? formImageNames.map((name) => ensureImageExtension(name)).filter(Boolean)
        : [];

      try {
        setPreviewLoading(true);

        const stems = getCandidateImageStems(
          {
            id: formId,
            imageBase: formImageBase,
            manufacturerCode: formManufacturerCode,
            sku: formSku,
            stock_code: formStockCode,
          },
          productId
        );
        let storageItems = { items: [] };
        if (stems.length) {
          try {
            storageItems = await listAll(ref(storage, "product_images"));
          } catch {
            storageItems = { items: [] };
          }
        }
        const discoveredGroups = stems.map((stem) => {
          const pattern = new RegExp(
            `^${escapeRegex(stem)}(?:-(\\d+))?\\.[a-z0-9]+$`,
            "i"
          );

          return storageItems.items
            .map((item) => item.name)
            .filter((itemName) => pattern.test(itemName));
        });

        const mergedNames = sortImageNamesByStem(
          Array.from(new Set([...names, ...discoveredGroups.flat()])),
          stems
        );

        if (!mergedNames.length) {
          if (!alive) return;
          setImagePreviews([]);
          return;
        }

        if (alive && (
          mergedNames.length !== names.length ||
          mergedNames.some((name, index) => name !== names[index])
        )) {
          set("image_names", mergedNames);
        }

        const results = await Promise.all(
          mergedNames.map(async (name) => {
            try {
              const fileRef = ref(storage, `product_images/${name}`);
              const url = await getDownloadURL(fileRef);
              return { name, url, ok: true };
            } catch (e) {
              return {
                name,
                url: "",
                ok: false,
                error: e?.message || "Görsel URL alınamadı.",
              };
            }
          })
        );

        if (!alive) return;
        setImagePreviews(results);
      } finally {
        if (alive) setPreviewLoading(false);
      }
    }

    loadPreviewUrls();

    return () => {
      alive = false;
    };
  }, [
    formId,
    formImageBase,
    formImageNames,
    formManufacturerCode,
    formSku,
    formStockCode,
    productId,
  ]);

  async function onUploadPhotos() {
    if (!form) return;

    setErr("");
    setUploadInfo(null);

    try {
      const files = fileRef.current?.files;

      if (!files || files.length === 0) {
        throw new Error("Önce foto seç.");
      }

      setUploading(true);

      const res = await uploadProductImages({
        stockCode: productId,
        files,
        existingImageNames: form.image_names || [],
        onProgress: (progress) => setUploadInfo(progress),
      });

      set("image_names", res.imageNames || []);

      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setErr(e?.message || "Foto yükleme hatası.");
    } finally {
      setUploading(false);
    }
  }

  function removeImageName(name) {
    const cleanName = (name || "").toString().trim();
    if (!cleanName) return;

    set(
      "image_names",
      (form.image_names || []).filter((x) => x !== cleanName)
    );
  }

  async function onSave() {
    if (!form) return;

    setErr("");

    try {
      setWorking(true);

      await updateProduct(productId, {
        ...form,
        image_names: form.image_names || [],
      });

      router.refresh?.();
    } catch (e) {
      setErr(e?.message || "Kaydetme başarısız.");
    } finally {
      setWorking(false);
    }
  }

  const hasImages = useMemo(
    () => Array.isArray(form?.image_names) && form.image_names.length > 0,
    [form?.image_names]
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
          aria-label="Geri"
          title="Geri"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
          aria-label="Satış/Stok Ana Sayfa"
          title="Satış/Stok Ana Sayfa"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Yükleniyor...</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Ürün Düzenle: <span className="font-mono">{productId}</span>
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Firestore ürün dokümanındaki alanlar görüntülenir; düzenlenebilir alanlar kaydedilebilir.
              </p>
            </div>

            <button
              onClick={onSave}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {working ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>

          <Section
            title="Fotoğraflar"
            description="Storage klasörü: product_images/. İsim yapısı belge anahtarına göre korunur."
          >
            <div className="text-xs text-gray-600">
              <b>{productId}.jpg</b>, sonra <b>{productId}-1.jpg</b>, <b>{productId}-2.jpg</b>...
            </div>

            {previewLoading ? (
              <div className="text-sm text-gray-500">Fotoğraflar yükleniyor...</div>
            ) : hasImages ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-800">Mevcut Fotoğraflar</div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {imagePreviews.map((img) => (
                    <div key={img.name} className="overflow-hidden rounded-xl border bg-white">
                      <div className="flex aspect-square items-center justify-center overflow-hidden bg-gray-100">
                        {img.ok && img.url ? (
                          <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="p-4 text-center text-xs text-red-600">Görsel yüklenemedi</div>
                        )}
                      </div>

                      <div className="space-y-2 p-3">
                        <div className="break-all text-[11px] font-mono text-gray-700">{img.name}</div>

                        <div className="flex items-center justify-between gap-2">
                          {img.ok && img.url ? (
                            <a
                              href={img.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              büyüt
                            </a>
                          ) : (
                            <span className="text-[11px] text-red-500">URL alınamadı</span>
                          )}

                          <button
                            type="button"
                            onClick={() => removeImageName(img.name)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            kaldır
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-gray-500">
                  “kaldır” işlemi sadece `image_names` listesinden çıkarır, Storage dosyasını silmez.
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-800">Bu ürüne ait fotoğraf yok.</div>
                <div className="mt-1 text-xs text-gray-600">Aşağıdan bir veya birden fazla fotoğraf ekleyebilirsin.</div>
              </div>
            )}

            {uploadInfo ? (
              <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
                <div className="flex items-center gap-2 font-semibold">
                  <UploadCloud className="h-4 w-4" />
                  Foto yükleniyor
                </div>
                <div>
                  {uploadInfo.stage === "uploading" ? "Yükleniyor" : "Tamamlandı"}:{" "}
                  <b>{uploadInfo.filename}</b> ({uploadInfo.index + 1}/{uploadInfo.total})
                </div>
              </div>
            ) : null}

            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <input ref={fileRef} type="file" accept="image/*" multiple className="block w-full text-sm" />
              <button
                onClick={onUploadPhotos}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 hover:bg-gray-50 disabled:opacity-60"
              >
                <UploadCloud className="h-4 w-4" />
                {uploading ? "Yükleniyor..." : "Foto Yükle"}
              </button>
            </div>

            <Field label="image_names" hint="Upload sonrası otomatik güncellenir">
              <textarea
                value={(form.image_names || []).join("\n")}
                readOnly
                className="min-h-[90px] w-full rounded-lg border bg-gray-50 px-3 py-2 font-mono text-xs"
              />
            </Field>
          </Section>

          <Section title="Kimlik ve Durum" description="Belge anahtarı, temel kimlik alanları ve durum bayrakları">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Belge ID" hint="Firestore belge kimliği">
                <input value={form.id} disabled className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm" />
              </Field>

              <Field label="Stok Kodu" hint="Uyumluluk alanı">
                <input
                  value={form.stock_code}
                  disabled
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="SKU" hint="Belge anahtarıyla uyumlu tutulur">
                <input
                  value={form.sku}
                  disabled
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Üretici Kodu">
                <input
                  value={form.manufacturerCode}
                  onChange={(e) => set("manufacturerCode", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Barkod">
                <input
                  value={form.barcode}
                  onChange={(e) => set("barcode", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Rozet">
                <select
                  value={form.badge}
                  onChange={(e) => set("badge", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">{t("product.badges.none")}</option>
                  {BADGE_OPTIONS.map((badge) => (
                    <option key={badge.value} value={badge.value}>
                      {t(badge.labelKey) === badge.labelKey ? badge.fallback : t(badge.labelKey)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ürün Tipi">
                <select
                  value={form.productType}
                  onChange={(e) => set("productType", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="sale_item">sale_item</option>
                  <option value="consumable">consumable</option>
                  <option value="service">service</option>
                </select>
              </Field>

              <Field label="Fiyat">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="KDV Oranı">
                <input
                  type="number"
                  value={form.vatRate}
                  onChange={(e) => set("vatRate", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Sıra">
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => set("order", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Liste Sırası">
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => set("sortOrder", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Popülerlik">
                <input
                  value={form.popular}
                  onChange={(e) => set("popular", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border p-4 md:grid-cols-3">
              {[
                ["active", "Aktif"],
                ["webPublished", "Web'de Yayınla"],
                ["isNew", "Yeni Ürün"],
                ["saleEnabled", "Satışa Açık"],
                ["purchaseEnabled", "Satınalmaya Açık"],
                ["stockTracked", "Stok Takibi"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form[key]}
                    onChange={(e) => set(key, e.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="İsim ve İçerik" description="Çok dilli isimler, özet ve açıklama alanları">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Ürün Adı">
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Ürün Adı (TR)">
                <input
                  value={form.name_tr}
                  onChange={(e) => set("name_tr", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Kısa Açıklama">
              <textarea
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                className="min-h-[90px] w-full rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Açıklama">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="min-h-[130px] w-full rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Teknik Özellikler">
              <textarea
                value={form.specs}
                onChange={(e) => set("specs", e.target.value)}
                className="min-h-[130px] w-full rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field
              label="Detay Sayfasi 3 Satir"
              hint="Her satir urun detay sayfasinda ayri satir olarak gosterilir."
            >
              <textarea
                value={form.highlightLines}
                onChange={(e) => set("highlightLines", e.target.value)}
                className="min-h-[130px] w-full rounded-lg border px-3 py-2 text-sm"
                placeholder={DEFAULT_HIGHLIGHT_LINES}
              />
            </Field>

            <Field label="Arama Metni">
              <textarea
                value={form.searchText}
                onChange={(e) => set("searchText", e.target.value)}
                className="min-h-[90px] w-full rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Etiketler" hint="Virgülle ayır">
                <textarea
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  className="min-h-[90px] w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Bağlantılı Kodlar" hint="Virgülle ayır">
                <textarea
                  value={form.binding_codes}
                  onChange={(e) => set("binding_codes", e.target.value)}
                  className="min-h-[90px] w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </Section>

          <Section title="Katalog Eşlemesi" description="Route ve katalog filtreleme tarafında kullanılan alanlar">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Grup">
                <input
                  value={form.group}
                  onChange={(e) => set("group", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Grup Anahtarı">
                <input
                  value={form.groupKey}
                  onChange={(e) => set("groupKey", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Slug">
                <input
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Kategori">
                <input
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Kategori Anahtarı">
                <input
                  value={form.categoryKey}
                  onChange={(e) => {
                    set("categoryKey", e.target.value);
                    set("main_category", e.target.value);
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Ana Kategori" hint="Admin uyumluluk alanı">
                <input
                  value={form.main_category}
                  onChange={(e) => set("main_category", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Alt Kategori">
                <input
                  value={form.subcategory}
                  onChange={(e) => set("subcategory", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Alt Kategori Anahtarı">
                <input
                  value={form.subcategoryKey}
                  onChange={(e) => {
                    set("subcategoryKey", e.target.value);
                    set("sub_category", e.target.value);
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Alt Kategori Kısa Alanı" hint="Admin uyumluluk alanı">
                <input
                  value={form.sub_category}
                  onChange={(e) => set("sub_category", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </Section>

          <Section title="Teknik Bilgiler" description="Ürünün teknik ve fiziksel özellikleri">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Marka">
                <input
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Birim">
                <input
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Ağırlık">
                <input
                  value={form.weight}
                  onChange={(e) => set("weight", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Kapasite">
                <input
                  value={form.capacity}
                  onChange={(e) => set("capacity", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Ölçüler">
                <input
                  value={form.dimensions}
                  onChange={(e) => set("dimensions", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Materyal">
                <input
                  value={form.material}
                  onChange={(e) => set("material", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Paket İçi Miktar">
                <input
                  type="number"
                  value={form.packQty}
                  onChange={(e) => set("packQty", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Koli İçi Miktar">
                <input
                  type="number"
                  value={form.caseQty}
                  onChange={(e) => set("caseQty", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field
                label={
                  t("admin.products.fields.unitType") === "admin.products.fields.unitType"
                    ? "Birim Tipi"
                    : t("admin.products.fields.unitType")
                }
              >
                <select
                  value={form.unitType}
                  onChange={(e) => set("unitType", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">{t("common.select")}</option>
                  {UNIT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`productDetail.packaging.unitType.${option}`)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Yakıt Tipi">
                <input
                  value={form.fuelType}
                  onChange={(e) => set("fuelType", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Güç">
                <input
                  value={form.power}
                  onChange={(e) => set("power", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Voltaj">
                <input
                  value={form.voltage}
                  onChange={(e) => set("voltage", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Garanti">
                <input
                  value={form.warranty}
                  onChange={(e) => set("warranty", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </Section>

          <Section title="Medya ve Linkler" description="Dış kaynak bağlantıları ve türetilmiş medya alanları">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Ana Görsel Kodu">
                <input
                  value={form.imageBase}
                  onChange={(e) => set("imageBase", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Video Bağlantısı">
                <input
                  value={form.videoUrl}
                  onChange={(e) => set("videoUrl", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Katalog PDF">
                <input
                  value={form.catalogPdf}
                  onChange={(e) => set("catalogPdf", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Teknik PDF">
                <input
                  value={form.technicalPdf}
                  onChange={(e) => set("technicalPdf", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </Section>

          <Section title="Meta ve Zaman Bilgileri" description="İçe aktarma ve sistem metadata alanları">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Oluşturulma Tarihi" hint="Salt okunur">
                <input
                  value={String(form.createdAt || "")}
                  readOnly
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Güncellenme Tarihi" hint="Salt okunur">
                <input
                  value={String(form.updatedAt || "")}
                  readOnly
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Meta Bilgisi" hint="JSON formatı">
              <textarea
                value={form.meta}
                onChange={(e) => set("meta", e.target.value)}
                className="min-h-[180px] w-full rounded-lg border px-3 py-2 font-mono text-xs"
              />
            </Field>
          </Section>
        </>
      )}
    </div>
  );
}
