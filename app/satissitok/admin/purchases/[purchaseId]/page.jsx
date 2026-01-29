// app/satissitok/admin/purchases/[purchaseId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { ChevronLeft, Printer, Trash2, Calendar, Hash, Layers } from "lucide-react";
import { cancelPurchase } from "@/app/satissitok/services/purchaseService";

export default function PurchaseDetailPage() {
  const { purchaseId } = useParams();
  const router = useRouter();

  const [purchase, setPurchase] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function reload() {
    if (!purchaseId) return;

    const ref = doc(db, "purchases", purchaseId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      setPurchase(null);
      setItems([]);
      setLoading(false);
      return;
    }

    const data = snap.data();

setPurchase({ id: purchaseId, ...data });
setItems(data.items || []);
setLoading(false);

    setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  function formatDate(val) {
    if (!val) return "—";
    if (val?.toDate) return val.toDate().toLocaleDateString("tr-TR");
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("tr-TR");
    return String(val);
  }

  const computedTotals = useMemo(() => {
    // Doc totals tercih; yoksa items'tan hesapla
    const docNet = purchase?.totals?.net ?? purchase?.netTotal;
    const docVat = purchase?.totals?.tax ?? purchase?.vatTotal;
    const docGross = purchase?.totals?.gross ?? purchase?.grossTotal;

    if (docNet != null || docVat != null || docGross != null) {
      return {
        net: Number(docNet || 0),
        vat: Number(docVat || 0),
        gross: Number(docGross || 0),
      };
    }

    const net = items.reduce((s, it) => s + Number(it.netLineTotal ?? it.net ?? 0), 0);
    const vat = items.reduce((s, it) => s + Number(it.vatLineTotal ?? it.vat ?? 0), 0);
    const gross = items.reduce((s, it) => s + Number(it.grossLineTotal ?? it.total ?? 0), 0);

    return {
      net: Math.round(net * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      gross: Math.round(gross * 100) / 100,
    };
  }, [purchase, items]);

  async function handleCancel() {
    if (!purchaseId || !purchase) return;

    const isCancelled = purchase.status === "cancelled";
    if (isCancelled) return;

    const ok = confirm(
      "Bu satınalmayı iptal etmek istiyor musunuz?\nBu işlem belgeyi 'İptal' durumuna alır."
    );
    if (!ok) return;

    setWorking(true);
    try {
      await cancelPurchase({ purchaseId });
      await reload();
    } catch (e) {
      alert(e?.message || "Satınalma iptal edilirken hata oluştu");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center text-gray-500">
        Satınalma kaydı bulunamadı.
      </div>
    );
  }

  const isCancelled = purchase.status === "cancelled";
  const typeLabel = purchase.purchaseType === "official" ? "🏢 Resmi" : "📦 Fiili";

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* ÜST NAV */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={16} className="mr-1" /> Satınalma Listesine Dön
        </button>

        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
            <Printer size={18} />
          </button>

          {!isCancelled && (
            <button
              onClick={handleCancel}
              disabled={working}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all shadow-sm active:scale-95"
            >
              <Trash2 size={16} />
              {working ? "İptal ediliyor…" : "Satınalmayı İptal Et"}
            </button>
          )}
        </div>
      </div>

      {/* ANA KART */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">
                  {purchase.invoiceNo || "Fatura No Yok"}
                </h1>

                {isCancelled ? (
                  <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
                    İPTAL EDİLDİ
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 uppercase">
                    Tamamlandı
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar size={14} /> {formatDate(purchase.documentDate || purchase.invoiceDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Hash size={14} /> ID: {String(purchase.id).slice(-6).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-right">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Satınalma Türü</p>
                <p className="font-semibold text-gray-700">{typeLabel}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tedarikçi</p>
                <p className="font-semibold text-gray-700 text-indigo-600 uppercase italic">
                  {purchase.supplierName || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* ÜRÜN TABLOSU */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  <th className="pb-3 text-left">Ürün Detayı</th>
                  <th className="pb-3 text-center px-4">Birim / Miktar</th>
                  <th className="pb-3 text-right px-4">Birim Fiyat</th>
                  <th className="pb-3 text-right px-4">Net Tutar</th>
                  <th className="pb-3 text-right px-4">KDV</th>
                  <th className="pb-3 text-right pl-4">Genel Toplam</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {items.map((it) => {
                  const productName = it.productName || it.name || it.title || "-";
                  const qty = Number(it.quantity || it.qty || 0);
                  const unit = it.unit || it.unitName || "";
                  const unitPrice = Number(it.unitPrice || it.price || 0);

                  const net = Number(it.netLineTotal ?? it.net ?? 0);
                  const vat = Number(it.vatLineTotal ?? it.vat ?? 0);
                  const gross = Number(it.grossLineTotal ?? it.total ?? 0);

                  return (
                    <tr key={it.id} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                            <Layers size={14} />
                          </div>
                          <span className="text-sm font-semibold text-gray-800 line-clamp-2">{productName}</span>
                        </div>
                      </td>

                      <td className="py-4 text-center px-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-600 font-medium">{qty}</span>
                          <span className="text-[10px] text-gray-400 uppercase">{unit}</span>
                        </div>
                      </td>

                      <td className="py-4 text-right text-sm text-gray-600 font-mono px-4">
                        {unitPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 text-right text-sm text-gray-600 font-mono px-4">
                        {net.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 text-right text-sm text-gray-500 font-mono px-4">
                        {vat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 text-right text-sm font-bold text-gray-900 font-mono pl-4">
                        {gross.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      Ürün kalemi bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOPLAMLAR */}
        <div className="bg-gray-50 p-6 md:p-8 border-t border-gray-100">
          <div className="flex flex-col items-end gap-3">
            <div className="flex justify-between items-center w-full md:w-80 text-sm">
              <span className="text-gray-500">Ara Toplam (Net)</span>
              <span className="font-mono text-gray-700">
                {computedTotals.net.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₸
              </span>
            </div>

            <div className="flex justify-between items-center w-full md:w-80 text-sm border-b border-gray-200 pb-3">
              <span className="text-gray-500">Toplam KDV</span>
              <span className="font-mono text-gray-700">
                {computedTotals.vat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₸
              </span>
            </div>

            <div className="flex justify-between items-center w-full md:w-80 pt-2 gap-4">
              <span className="text-lg font-bold text-gray-900 uppercase whitespace-nowrap">Genel Toplam</span>
              <span className="text-2xl font-bold text-indigo-600 font-mono tracking-tighter whitespace-nowrap">
                {computedTotals.gross.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                <span className="text-sm ml-2">₸</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-gray-400 text-center uppercase tracking-widest">
        Bu belge sistem tarafından otomatik oluşturulmuştur.
      </div>
    </div>
  );
}
