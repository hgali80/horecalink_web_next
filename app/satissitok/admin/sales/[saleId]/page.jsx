//app/satissitok/admin/sales/[saleId]/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { AlertTriangle, ChevronLeft, Printer, Trash2, Calendar, Hash, Tag, Layers } from "lucide-react";
import { cancelSale } from "@/app/satissitok/services/saleService";

export default function SaleDetailPage() {
  const { saleId } = useParams();
  const router = useRouter();

  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!saleId) return;

    const load = async () => {
      const saleRef = doc(db, "sales", saleId);
      const saleSnap = await getDoc(saleRef);

      if (!saleSnap.exists()) {
        setSale(null);
        setLoading(false);
        return;
      }

      const itemsSnap = await getDocs(
        collection(db, "sales", saleId, "items")
      );

      setSale({ id: saleId, ...saleSnap.data() });
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };

    load();
  }, [saleId]);

  async function handleCancelSale() {
    if (!sale || sale.status !== "completed") return;

    const ok = confirm(
      "Bu satışı iptal etmek istiyor musunuz?\nStoklar otomatik olarak geri eklenecektir."
    );
    if (!ok) return;

    setWorking(true);
    try {
      await cancelSale({ saleId });

      const saleRef = doc(db, "sales", saleId);
      const saleSnap = await getDoc(saleRef);
      const itemsSnap = await getDocs(
        collection(db, "sales", saleId, "items")
      );

      setSale({ id: saleId, ...saleSnap.data() });
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      alert(e?.message || "Satış iptal edilirken hata oluştu");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!sale) return (
    <div className="max-w-5xl mx-auto p-12 text-center text-gray-500">
      Satış kaydı bulunamadı.
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* ÜST NAVİGASYON & AKSİYONLAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={16} className="mr-1" /> Satış Listesine Dön
        </button>
        
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
            <Printer size={18} />
          </button>
          {sale.status === "completed" && (
            <button
              onClick={handleCancelSale}
              disabled={working}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all shadow-sm active:scale-95"
            >
              <Trash2 size={16} />
              {working ? "İptal ediliyor…" : "Satışı İptal Et"}
            </button>
          )}
        </div>
      </div>

      {/* ANA BİLGİ KARTI */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">
                  {sale.invoiceNo || "Fatura No Yok"}
                </h1>
                {sale.status === "cancelled" ? (
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
                <span className="flex items-center gap-1"><Calendar size={14} /> 2026/01/29</span>
                <span className="flex items-center gap-1"><Hash size={14} /> ID: {sale.id.slice(-6).toUpperCase()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-right">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Satış Türü</p>
                <p className="font-semibold text-gray-700">{sale.saleType === "official" ? "🏢 Resmi" : "📦 Fiili"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Kanal / Platform</p>
                <p className="font-semibold text-gray-700 text-indigo-600 uppercase italic">{sale.saleChannel}</p>
              </div>
            </div>
          </div>

          {/* NEGATİF STOK UYARISI */}
          {sale.hasNegativeStock && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-4 items-start">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-800 uppercase">Kritik Stok Uyarısı</h3>
                <p className="text-sm text-amber-700 mt-1 italic">Bu satış sırasında aşağıdaki ürünler eksiye düşmüştür:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
                  {(sale.negativeStockItems || []).map((n, i) => (
                    <div key={i} className="flex justify-between bg-white/50 p-2 rounded border border-amber-100">
                      <span className="font-medium text-gray-700">{n.productId}</span>
                      <span className="text-red-600">Mevcut: {n.available} / Satılan: {n.sold}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ÜRÜN LİSTESİ */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  <th className="pb-3 text-left">Ürün Detayı</th>
                  <th className="pb-3 text-center">Birim / Miktar</th>
                  <th className="pb-3 text-right">Birim Fiyat</th>
                  <th className="pb-3 text-right">Net Tutar</th>
                  <th className="pb-3 text-right">KDV</th>
                  <th className="pb-3 text-right">Genel Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((it) => (
                  <tr key={it.id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                          <Layers size={14} />
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{it.productName}</span>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-sm text-gray-600 font-medium">{it.quantity}</span>
                      <span className="text-[10px] ml-1 text-gray-400 uppercase">{it.unit}</span>
                    </td>
                    <td className="py-4 text-right text-sm text-gray-600 font-mono">
                      {Number(it.unitPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 text-right text-sm text-gray-600 font-mono">
                      {Number(it.net || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 text-right text-sm text-gray-500 font-mono">
                      {Number(it.vat || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 text-right text-sm font-bold text-gray-900 font-mono">
                      {Number(it.total || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOPLAMLAR ALT ALAN */}
        <div className="bg-gray-50 p-6 md:p-8 border-t border-gray-100">
          <div className="flex flex-col items-end gap-3">
            <div className="flex justify-between w-full md:w-64 text-sm">
              <span className="text-gray-500">Ara Toplam (Net)</span>
              <span className="font-mono text-gray-700">{Number(sale.netTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
            </div>
            <div className="flex justify-between w-full md:w-64 text-sm border-b border-gray-200 pb-3">
              <span className="text-gray-500">Toplam KDV</span>
              <span className="font-mono text-gray-700">{Number(sale.vatTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
            </div>
            <div className="flex justify-between w-full md:w-64 pt-2">
              <span className="text-lg font-bold text-gray-900 uppercase">Genel Toplam</span>
              <span className="text-2xl font-bold text-indigo-600 font-mono tracking-tighter">
                {Number(sale.grossTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} 
                <span className="text-sm ml-1">TL</span>
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