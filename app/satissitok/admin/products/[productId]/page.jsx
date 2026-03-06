// app/satissitok/admin/products/[productId]/page.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Home, Save, UploadCloud } from "lucide-react";
import { getProduct, updateProduct, uploadProductImages } from "@/app/satissitok/services/productService";

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      {children}
    </label>
  );
}

export default function ProductDetailEditPage() {
  const { productId } = useParams();
  const router = useRouter();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [err, setErr] = useState("");

  const [form, setForm] = useState(null);

  function set(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const p = await getProduct(productId);
        if (!alive) return;
        if (!p) {
          setErr("Ürün bulunamadı.");
          return;
        }

        setForm({
          stock_code: p.stock_code ?? p.id,
          name: p.name ?? "",
          name_tr: p.name_tr ?? "",
          barcode: p.barcode ?? "",
          main_category: p.main_category ?? "",
          sub_category: p.sub_category ?? "",
          brand: p.brand ?? "",
          unit: p.unit ?? "шт",
          description: p.description ?? "",
          specs: p.specs ?? "",
          price: p.price ?? 0,
          order: p.order ?? 0,
          vatRate: p.vatRate ?? 16,
          productType: p.productType ?? "sale_item",
          image_names: Array.isArray(p.image_names) ? p.image_names : [],
          binding_codes: Array.isArray(p.binding_codes)
            ? p.binding_codes.join(",")
            : (p.binding_codes ?? ""),
          active: p.active ?? true,
          webPublished: p.webPublished ?? false,
          stockTracked: p.stockTracked ?? true,
          saleEnabled: p.saleEnabled ?? true,
          purchaseEnabled: p.purchaseEnabled ?? true,
        });
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Yükleme hatası.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, [productId]);

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
        onProgress: (p) => setUploadInfo(p),
      });

      set("image_names", res.imageNames);

      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setErr(e?.message || "Foto yükleme hatası.");
    } finally {
      setUploading(false);
    }
  }

  function removeImageName(name) {
    const n = (name || "").toString().trim();
    if (!n) return;
    set("image_names", (form.image_names || []).filter((x) => x !== n));
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

      {loading ? (
        <div className="text-sm text-gray-600">Yükleniyor...</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Ürün Düzenle: <span className="font-mono">{productId}</span>
            </h1>

            <button
              onClick={onSave}
              disabled={working}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {working ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>

          {/* FOTO YÜKLEME */}
          <section className="border rounded-xl p-4 space-y-2">
            <div className="font-semibold text-gray-900">Fotoğraflar</div>
            <div className="text-xs text-gray-600">
              Storage: <b>product_images/</b> • İsim:{" "}
              <b>{productId}.jpg</b>, sonra <b>{productId}-1.jpg</b>, <b>-2</b>...
            </div>

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

            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="block w-full text-sm"
              />
              <button
                onClick={onUploadPhotos}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60"
              >
                <UploadCloud className="w-4 h-4" />
                {uploading ? "Yükleniyor..." : "Foto Yükle"}
              </button>
            </div>

            {Array.isArray(form.image_names) && form.image_names.length > 0 ? (
              <div className="text-xs text-gray-700">
                <div className="font-semibold mt-2">image_names</div>
                <ul className="space-y-1">
                  {form.image_names.map((x) => (
                    <li
                      key={x}
                      className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2"
                    >
                      <span className="font-mono">{x}</span>
                      <button
                        type="button"
                        onClick={() => removeImageName(x)}
                        className="text-red-600 hover:underline"
                      >
                        kaldır
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="text-[11px] text-gray-500 mt-1">
                  Not: “kaldır” sadece Firestore listesinden çıkarır. Storage’dan silme yok
                  (istersen ekleriz).
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">Foto yok.</div>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Stok Kodu">
              <input
                value={form.stock_code}
                disabled
                className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50"
              />
            </Field>

            <Field label="Barkod">
              <input
                value={form.barcode}
                onChange={(e) => set("barcode", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Ürün Adı (RU/KZ)">
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
        </>
      )}
    </div>
  );
}