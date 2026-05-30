"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Home,
  ImagePlus,
  PlusCircle,
  Save,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import {
  deleteUsageArea,
  getUsageAreaById,
  updateUsageArea,
  uploadUsageAreaImage,
} from "@/app/satissitok/services/usageAreaService";
import { listProductsAdmin } from "@/app/satissitok/services/productService";

const STORAGE_BUCKET = "horecakatalog-e2d10.firebasestorage.app";
const PLACEHOLDER_IMAGE = "/Placeholder.png";

function cleanText(value) {
  return (value ?? "").toString().trim();
}

function getProductImageUrl(product) {
  const imageNames = Array.isArray(product?.image_names)
    ? product.image_names.filter(Boolean)
    : [];
  const imageName =
    imageNames[0] ||
    cleanText(product?.imageBase ? `${product.imageBase}` : "");

  if (!imageName) return PLACEHOLDER_IMAGE;

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/product_images%2F${encodeURIComponent(
    /\.[a-z0-9]+$/i.test(imageName) ? imageName : `${imageName}.jpg`
  )}?alt=media`;
}

function buildInitialForm(area) {
  return {
    name_tr: area.name_tr || "",
    name_kz: area.name_kz || "",
    name_ru: area.name_ru || "",
    name_en: area.name_en || "",
    description_tr: area.description_tr || "",
    description_kz: area.description_kz || "",
    description_ru: area.description_ru || "",
    description_en: area.description_en || "",
    imageName: area.imageName || "",
    imagePath: area.imagePath || "",
    imageUrl: area.imageUrl || "",
    imagePreviewUrl: area.imagePreviewUrl || "/Placeholder.png",
    isActive: area.isActive === true,
    showOnHome: area.showOnHome === true,
    order: Number(area.order || 0),
    productIds: Array.isArray(area.productIds) ? area.productIds : [],
    slug: area.slug || "",
  };
}

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
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function UsageAreaDetailPage() {
  const { usageAreaId } = useParams();
  const router = useRouter();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [products, setProducts] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [selectedToAdd, setSelectedToAdd] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [areaData, productList] = await Promise.all([
        getUsageAreaById(usageAreaId),
        listProductsAdmin(),
      ]);

      if (!areaData) {
        setError("Kullanim alani bulunamadi.");
        return;
      }

      setForm(buildInitialForm(areaData));
      setProducts(productList);
    } catch (err) {
      setError(err?.message || "Sayfa yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [usageAreaId]);

  useEffect(() => {
    load();
  }, [load]);

  function setField(key, value) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  async function persist(nextValues, successMessage = "") {
    if (!form) return;
    const payload = { ...form, ...nextValues };

    try {
      setWorking(true);
      await updateUsageArea(usageAreaId, payload);
      const fresh = await getUsageAreaById(usageAreaId);
      setForm(buildInitialForm(fresh));
      if (successMessage) {
        alert(successMessage);
      }
    } catch (err) {
      alert(err?.message || "Kaydetme islemi basarisiz oldu.");
    } finally {
      setWorking(false);
    }
  }

  async function handleSave() {
    await persist({}, "Kullanim alani kaydedildi.");
  }

  async function handleDelete() {
    const ok = window.confirm("Bu kullanim alani silinsin mi?");
    if (!ok) return;

    try {
      setWorking(true);
      await deleteUsageArea(usageAreaId);
      router.push("/satissitok/admin/usage-areas");
    } catch (err) {
      alert(err?.message || "Kullanim alani silinemedi.");
    } finally {
      setWorking(false);
    }
  }

  async function handleUploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const uploaded = await uploadUsageAreaImage({
        usageAreaId,
        file,
      });
      await persist(uploaded, "Gorsel yüklendi.");
    } catch (err) {
      alert(err?.message || "Gorsel yuklenemedi.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setUploading(false);
    }
  }

  const selectedProducts = useMemo(() => {
    if (!form) return [];
    const index = new Map(products.map((item) => [item.id, item]));
    return form.productIds.map((id) => index.get(id)).filter(Boolean);
  }, [form, products]);

  const availableProducts = useMemo(() => {
    if (!form) return [];
    const selected = new Set(form.productIds);
    const normalized = pickerQuery.trim().toLowerCase();

    return products
      .filter((item) => !selected.has(item.id))
      .filter((item) => {
        if (!normalized) return true;
        const haystack = [
          item.id,
          item.stock_code,
          item.slug,
          item.name,
          item.name_tr,
          item.brand,
          item.categoryKey,
          item.subcategoryKey,
        ]
          .map(cleanText)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      });
  }, [form, pickerQuery, products]);

  async function handleAddProducts() {
    if (!selectedToAdd.length) return;
    const nextIds = Array.from(new Set([...(form?.productIds || []), ...selectedToAdd]));
    setSelectedToAdd([]);
    await persist({ productIds: nextIds }, "Urunler kullanim alanina eklendi.");
  }

  async function handleRemoveProduct(productId) {
    const nextIds = (form?.productIds || []).filter((id) => id !== productId);
    await persist({ productIds: nextIds }, "Urun baglantisi kaldirildi.");
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Yukleniyor...</div>;
  }

  if (error || !form) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Kayit bulunamadi."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>

        <Link
          href="/satissitok/admin/usage-areas"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition-all hover:bg-gray-50"
        >
          <span className="text-sm font-semibold">Kullanim Alanlari</span>
        </Link>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {form.name_tr || form.name_ru || "Kullanim Alani"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Slug: {form.slug}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={working}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Kaydet
          </button>

          <button
            type="button"
            disabled={working}
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Section
            title="Cok Dilli Icerik"
            description="Site dili degistiginde ilgili ad ve aciklama otomatik kullanilir."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ad (TR)">
                <input
                  value={form.name_tr}
                  onChange={(event) => setField("name_tr", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
              <Field label="Ad (KZ)">
                <input
                  value={form.name_kz}
                  onChange={(event) => setField("name_kz", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
              <Field label="Ad (RU)">
                <input
                  value={form.name_ru}
                  onChange={(event) => setField("name_ru", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
              <Field label="Ad (EN)">
                <input
                  value={form.name_en}
                  onChange={(event) => setField("name_en", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Aciklama (TR)">
                <textarea
                  value={form.description_tr}
                  onChange={(event) => setField("description_tr", event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
              <Field label="Aciklama (KZ)">
                <textarea
                  value={form.description_kz}
                  onChange={(event) => setField("description_kz", event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
              <Field label="Aciklama (RU)">
                <textarea
                  value={form.description_ru}
                  onChange={(event) => setField("description_ru", event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
              <Field label="Aciklama (EN)">
                <textarea
                  value={form.description_en}
                  onChange={(event) => setField("description_en", event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Bagli Urunler"
            description="Urun ekle butonundan Firestore urunlerini secip bu alana baglayabilirsin."
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-500">
                Toplam bagli urun: <span className="font-semibold text-slate-900">{selectedProducts.length}</span>
              </div>

              <button
                type="button"
                onClick={() => setPickerOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                <PlusCircle className="h-4 w-4" />
                Urun Ekle
              </button>
            </div>

            {pickerOpen ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-4">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <input
                    value={pickerQuery}
                    onChange={(event) => setPickerQuery(event.target.value)}
                    placeholder="Ara: urun adi, SKU, slug, kategori..."
                    className="w-full text-sm outline-none"
                  />
                </div>

                <div className="mt-4 max-h-[380px] space-y-2 overflow-y-auto">
                  {availableProducts.map((product) => {
                    const checked = selectedToAdd.includes(product.id);
                    return (
                      <label
                        key={product.id}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedToAdd((current) =>
                              event.target.checked
                                ? [...current, product.id]
                                : current.filter((item) => item !== product.id)
                            );
                          }}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          <Image
                            src={getProductImageUrl(product)}
                            alt={product.name || product.id}
                            fill
                            unoptimized
                            sizes="56px"
                            className="object-contain p-1.5"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900">{product.name || product.id}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {product.stock_code || product.id} · {product.brand || "-"} ·{" "}
                            {product.categoryKey || "-"} / {product.subcategoryKey || "-"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">
                    Secilen: <span className="font-semibold text-slate-900">{selectedToAdd.length}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedToAdd([]);
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                      Kapat
                    </button>
                    <button
                      type="button"
                      disabled={!selectedToAdd.length || working}
                      onClick={handleAddProducts}
                      className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Ekle
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {selectedProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  Henuz bu kullanim alanina bagli urun yok.
                </div>
              ) : (
                selectedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <Image
                          src={getProductImageUrl(product)}
                          alt={product.name || product.id}
                          fill
                          unoptimized
                          sizes="56px"
                          className="object-contain p-1.5"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{product.name || product.id}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {product.stock_code || product.id} · {product.brand || "-"} ·{" "}
                          {product.slug || "-"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={working}
                      onClick={() => handleRemoveProduct(product.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      Kaldir
                    </button>
                  </div>
                ))
              )}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            title="Vitrin Ayarlari"
            description="Ana sayfada sadece aktif ve ana sayfada goster secili kayitlar listelenir."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sira">
                <input
                  type="number"
                  value={form.order}
                  onChange={(event) => setField("order", Number(event.target.value || 0))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>

              <Field label="Slug" hint="Ilk olusumda otomatik uretilir, istersen duzenleyebilirsin">
                <input
                  value={form.slug}
                  onChange={(event) => setField("slug", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-600"
                />
              </Field>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Aktif</div>
                <div className="text-xs text-slate-500">Pasif olursa vitrin ve liste sayfalarinda cikmaz.</div>
              </div>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setField("isActive", event.target.checked)}
                className="h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Ana sayfada goster</div>
                <div className="text-xs text-slate-500">Ana sayfa bolumunde sadece ilk 4 kayit gosterilir.</div>
              </div>
              <input
                type="checkbox"
                checked={form.showOnHome}
                onChange={(event) => setField("showOnHome", event.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </Section>

          <Section
            title="Kart Gorseli"
            description="Tiklayip bilgisayardan gorsel secebilir, yukledikten sonra kartta hemen gorebilirsin."
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUploadImage}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="group relative block w-full overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100"
            >
              <div className="relative h-[260px] w-full">
                <Image
                  src={form.imagePreviewUrl || "/Placeholder.png"}
                  alt={form.name_tr || form.name_ru || "Usage area image"}
                  fill
                  unoptimized
                  sizes="(max-width: 1280px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4 text-white">
                <div>
                  <div className="text-sm font-semibold">
                    {uploading ? "Gorsel yukleniyor..." : "Kart gorselini degistir"}
                  </div>
                  <div className="mt-1 text-xs text-white/80">
                    Dosya secip storage&apos;a yuklemek icin tikla
                  </div>
                </div>
                <div className="rounded-full bg-white/15 p-3 backdrop-blur">
                  {form.imagePreviewUrl ? (
                    <ImagePlus className="h-5 w-5" />
                  ) : (
                    <UploadCloud className="h-5 w-5" />
                  )}
                </div>
              </div>
            </button>
          </Section>
        </div>
      </div>
    </div>
  );
}
