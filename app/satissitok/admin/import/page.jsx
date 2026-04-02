"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Database,
  FileSpreadsheet,
  Home,
  RefreshCw,
  UploadCloud,
} from "lucide-react";

import { useAuth } from "@/app/context/AuthContext";
import { auth } from "@/firebase";

const DEFAULT_PATH = "D:\\web uygulaması araçları\\horecalink_urunleri_tam_liste.xlsx";
const DEFAULT_SHEET = "Urun_Sablonu";
const ALLOWED_ROLES = new Set(["super_admin", "admin"]);

function SummaryCard({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function ProductImportPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fileRef = useRef(null);

  const [excelPath, setExcelPath] = useState(DEFAULT_PATH);
  const [sheetName, setSheetName] = useState(DEFAULT_SHEET);
  const [dryRun, setDryRun] = useState(true);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("slate");
  const [result, setResult] = useState(null);
  const [details, setDetails] = useState([]);

  const canImport = useMemo(() => ALLOWED_ROLES.has(user?.role), [user?.role]);

  async function getIdTokenOrThrow() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Oturum bulunamadi. Lutfen yeniden giris yapin.");
    }
    return currentUser.getIdToken(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    setMessageTone("slate");
    setResult(null);
    setDetails([]);

    try {
      const idToken = await getIdTokenOrThrow();
      const formData = new FormData();
      const selectedFile = fileRef.current?.files?.[0];

      formData.append("sheetName", sheetName);
      formData.append("dryRun", String(dryRun));
      formData.append("excelPath", excelPath);

      if (selectedFile) {
        formData.append("excelFile", selectedFile);
      }

      const response = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          message: data?.error || "Import islemi basarisiz oldu.",
          details: Array.isArray(data?.details) ? data.details : [],
        };
      }

      setResult(data.result || null);
      setDetails([]);
      setMessage(
        dryRun
          ? "Onizleme tamamlandi. Sonuclari inceleyip gercek importu calistirabilirsin."
          : "Import tamamlandi. Firestore products koleksiyonu Excel ile senkronize edildi."
      );
      setMessageTone("green");
    } catch (error) {
      setMessage(error?.message || "Import islemi basarisiz oldu.");
      setMessageTone("red");
      setDetails(Array.isArray(error?.details) ? error.details : []);
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Yukleniyor...</div>
      </div>
    );
  }

  if (!canImport) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Geri</span>
          </button>

          <Link
            href="/satissitok/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <Home size={18} />
            <span className="text-sm font-semibold">Ana Sayfa</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <div className="text-lg font-bold">Bu alan icin yetkin yok</div>
          <p className="mt-2 text-sm leading-6">
            Toplu import butun `products` koleksiyonunu Excel dosyasina gore ekler, gunceller ve eksik kalanlari siler.
            Bu nedenle yalnizca `admin` ve `super_admin` rolleri icin acildi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-semibold">Geri</span>
        </button>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <Home size={18} />
          <span className="text-sm font-semibold">Ana Sayfa</span>
        </Link>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(29,50,70,0.10),_transparent_38%),linear-gradient(135deg,#f8fafc_0%,#eef4f7_100%)] p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
              <FileSpreadsheet size={14} />
              Excel Import
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Toplu urun import ve tam senkronizasyon</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Bu ekran Excel dosyasini kaynak kabul eder. Her calistirmada yeni urunleri ekler, mevcut urunlerdeki farklari Excel&apos;e gore gunceller ve Excel&apos;de artik bulunmayan urunleri Firestore `products` koleksiyonundan siler.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/70 bg-white/80 p-4 text-sm text-slate-700 shadow-sm backdrop-blur sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 text-slate-500" />
              <div>
                <div className="font-semibold">Kaynak</div>
                <div className="text-xs text-slate-500">En saglam yontem dosyayi bu ekrandan secip yuklemek.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 h-4 w-4 text-slate-500" />
              <div>
                <div className="font-semibold">Davranis</div>
                <div className="text-xs text-slate-500">Ekle + guncelle + sil mantigi ile tam esitleme yapar.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UploadCloud className="mt-0.5 h-4 w-4 text-slate-500" />
              <div>
                <div className="font-semibold">Tip donusumu</div>
                <div className="text-xs text-slate-500">Boolean, sayi, string ve dizi alanlari uygun JSON formata cevrilir.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 text-slate-500" />
              <div>
                <div className="font-semibold">Gorseller</div>
                <div className="text-xs text-slate-500">Virgullu gorsel adlari `image_names` dizisine cevrilir.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Import ayarlari</h2>
            <p className="mt-1 text-sm text-slate-500">Dosya secersen yol yazmana gerek kalmaz. Yol alani yedek secenek olarak kalir.</p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Excel dosyasi ekle</span>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm text-slate-700"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setSelectedFileName(file?.name || "");
                }}
              />
              <div className="mt-2 text-xs text-slate-500">
                {selectedFileName ? `Secilen dosya: ${selectedFileName}` : "Butona basip gerekli Excel dosyasini secip import edebilirsin."}
              </div>
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Excel yolu</span>
            <input
              value={excelPath}
              onChange={(event) => setExcelPath(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
              placeholder={DEFAULT_PATH}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Sheet adi</span>
            <input
              value={sheetName}
              onChange={(event) => setSheetName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
              placeholder={DEFAULT_SHEET}
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-amber-300"
            />
            <span>
              <span className="font-semibold">Onizleme modu</span>
              <span className="mt-1 block text-xs leading-5 text-amber-800">
                Aciksa Firestore&apos;a yazmaz; sadece kac urun eklenecek, guncellenecek ve silinecek onu gosterir. Ilk calistirmada bunu acik tutmani oneririm.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={working}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {working ? "Calisiyor..." : dryRun ? "Onizleme yap" : "Importu baslat"}
            </button>

            <button
              type="button"
              onClick={() => {
                setExcelPath(DEFAULT_PATH);
                setSheetName(DEFAULT_SHEET);
                setSelectedFileName("");
                if (fileRef.current) {
                  fileRef.current.value = "";
                }
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Varsayilana don
            </button>
          </div>

          {message ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                messageTone === "green"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : messageTone === "red"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              {message}
            </div>
          ) : null}

          {details.length ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <div className="font-semibold">Dogrulama hatalari</div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Kurallar</h2>
            <p className="mt-1 text-sm text-slate-500">Import servisi mevcut urun yapisini bozmadan Excel&apos;i Firestore&apos;a uygun hale getirir.</p>
          </div>

          <div className="space-y-3 text-sm leading-6 text-slate-700">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">En guvenli kullanim: `Excel dosyasi ekle` ile dosyayi secip import etmek.</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">`id` alani dokuman kimligi olarak kullanilir; bos ise satir hata verir.</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">`imageBase` icindeki virgullu degerler `image_names` dizisine cevrilir ve uzantisi olmayanlara `.jpg` eklenir.</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">`binding_codes` ve `tags` alanlari diziye cevrilir; `price`, `sortOrder`, `vatRate` sayiya cevrilir.</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">`active`, `webPublished`, `isNew`, `stockTracked`, `saleEnabled`, `purchaseEnabled` alanlari boolean olarak kaydedilir.</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">Excel&apos;de olmayan bir urun Firestore&apos;da varsa, bu ekran onu siler.</div>
          </div>
        </section>
      </form>

      {result?.totals ? (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-slate-900">Son sonuc</h2>
            <p className="text-sm text-slate-500">
              Kaynak: <span className="font-medium text-slate-700">{result.excelPath}</span> · Sheet: <span className="font-medium text-slate-700">{result.sheetName}</span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="Excel satiri" value={result.totals.excelRows} tone="blue" />
            <SummaryCard label="Olusacak ekleme" value={result.totals.created} tone="green" />
            <SummaryCard label="Olusacak guncelleme" value={result.totals.updated} tone="amber" />
            <SummaryCard label="Degismeyen" value={result.totals.unchanged} tone="slate" />
            <SummaryCard label="Silinecek" value={result.totals.deleted} tone="red" />
            <SummaryCard label="Firestore once" value={result.totals.firestoreBefore} tone="slate" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">Eklenecek ornek ID&apos;ler</div>
              <div className="mt-3 max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">
                {result.createdIds?.length ? result.createdIds.join("\n") : "Yok"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">Guncellenecek ornek ID&apos;ler</div>
              <div className="mt-3 max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">
                {result.updatedIds?.length ? result.updatedIds.join("\n") : "Yok"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">Silinecek ornek ID&apos;ler</div>
              <div className="mt-3 max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">
                {result.deletedIds?.length ? result.deletedIds.join("\n") : "Yok"}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
