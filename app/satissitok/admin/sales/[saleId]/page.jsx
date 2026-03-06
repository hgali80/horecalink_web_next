// app/satissitok/admin/sales/[saleId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import {
  AlertTriangle,
  Printer,
  Trash2,
  Calendar,
  Hash,
  Layers,
  ArrowLeft,
  Home,
  Building2,
  Phone,
  User,
  FileDown,
} from "lucide-react";
import { cancelSale } from "@/app/satissitok/services/saleService";

function formatDate(d) {
  if (!d) return "-";
  const dt = d?.toDate ? d.toDate() : new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("tr-TR");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SaleDetailPage() {
  const { saleId } = useParams();
  const router = useRouter();

  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [cari, setCari] = useState(null);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!saleId) return;

    const load = async () => {
      setLoading(true);

      const saleRef = doc(db, "sales", saleId);
      const saleSnap = await getDoc(saleRef);

      if (!saleSnap.exists()) {
        setSale(null);
        setItems([]);
        setCari(null);
        setLoading(false);
        return;
      }

      const saleData = { id: saleId, ...saleSnap.data() };
      setSale(saleData);

      const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const cariId =
        saleData?.cariId || saleData?.customerId || saleData?.cari?.id;

      if (cariId) {
        try {
          const cariRef = doc(db, "caris", String(cariId));
          const cariSnap = await getDoc(cariRef);

          if (cariSnap.exists()) {
            setCari({ id: cariSnap.id, ...cariSnap.data() });
          } else {
            setCari({
              id: String(cariId),
              name:
                saleData?.cariName ||
                saleData?.customerName ||
                saleData?.customerTitle ||
                saleData?.companyName ||
                "-",
            });
          }
        } catch {
          setCari({
            id: String(cariId),
            name:
              saleData?.cariName ||
              saleData?.customerName ||
              saleData?.customerTitle ||
              saleData?.companyName ||
              "-",
          });
        }
      } else {
        const fallbackName =
          saleData?.cariName ||
          saleData?.customerName ||
          saleData?.customerTitle ||
          saleData?.companyName ||
          null;

        setCari(fallbackName ? { id: null, name: fallbackName } : null);
      }

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
      const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));

      const saleData = { id: saleId, ...saleSnap.data() };
      setSale(saleData);
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const cariId =
        saleData?.cariId || saleData?.customerId || saleData?.cari?.id;

      if (cariId) {
        const cariRef = doc(db, "caris", String(cariId));
        const cariSnap = await getDoc(cariRef);
        setCari(
          cariSnap.exists()
            ? { id: cariSnap.id, ...cariSnap.data() }
            : {
                id: String(cariId),
                name:
                  saleData?.cariName ||
                  saleData?.customerName ||
                  saleData?.customerTitle ||
                  saleData?.companyName ||
                  "-",
              }
        );
      }
    } catch (e) {
      alert(e?.message || "Satış iptal edilirken hata oluştu");
    } finally {
      setWorking(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleSavePdf() {
    window.print();
  }

  const cariTitle =
  cari?.firm ||
  cari?.title ||
  cari?.name ||
  cari?.unvan ||
  cari?.companyName ||
  sale?.cariTitle ||
  sale?.cariName ||
  sale?.customerName ||
  sale?.customerTitle ||
  sale?.companyName ||
  "-";

  const cariPhone =
    cari?.phone ||
    cari?.tel ||
    cari?.mobile ||
    sale?.customerPhone ||
    sale?.phone ||
    null;

  const saleDate =
    sale?.createdAt || sale?.date || sale?.issuedAt || sale?.created_at || null;

  const isOfficial = sale?.saleType === "official";
  const saleTypeShort = isOfficial ? "R" : "F";

  const visibleItems = useMemo(() => items || [], [items]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );

  if (!sale)
    return (
      <div className="max-w-5xl mx-auto p-12 text-center text-gray-500">
        Satış kaydı bulunamadı.
      </div>
    );

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
          }

          .print-hide {
            display: none !important;
          }

          .print-wrap {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          .print-section {
            padding: 0 !important;
          }

          .print-no-bg {
            background: #ffffff !important;
          }

          .print-table th,
          .print-table td {
            font-size: 12px !important;
          }

          .print-footer-note {
            margin-top: 20px !important;
            color: #666 !important;
          }

          @page {
            size: A4;
            margin: 14mm;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 print-wrap">
        {/* ÜST NAVİGASYON & AKSİYONLAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print-hide">
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
              title="Yazdır"
            >
              <Printer size={18} />
            </button>

            <button
              type="button"
              onClick={handleSavePdf}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
              title="PDF'ye Kaydet"
            >
              <FileDown size={18} />
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print-card">
          <div className="p-6 md:p-8 print-section">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
              <div className="space-y-2">
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

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <Building2 size={14} /> Müşteri:
                    </span>

                    {cari?.id ? (
                      <Link
                        href={`/satissitok/admin/cari/${cari.id}`}
                        className="font-semibold text-indigo-700 hover:underline"
                        title="Cari kartını aç"
                      >
                        {cariTitle}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-800 inline-flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        {cariTitle}
                      </span>
                    )}
                  </div>

                  {cariPhone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone size={13} />
                      <span className="font-medium">{cariPhone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} /> {formatDate(saleDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash size={14} /> ID: {sale.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 text-right">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Satış Türü
                  </p>
                  <p className="font-semibold text-gray-700 text-lg">
                    {saleTypeShort}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Kanal / Platform
                  </p>
                  <p className="font-semibold text-gray-700 text-indigo-600 uppercase italic">
                    {sale.saleChannel || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* NEGATİF STOK UYARISI */}
            {sale.hasNegativeStock && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-4 items-start print-hide">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-800 uppercase">
                    Kritik Stok Uyarısı
                  </h3>
                  <p className="text-sm text-amber-700 mt-1 italic">
                    Bu satış sırasında aşağıdaki ürünler eksiye düşmüştür:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
                    {(sale.negativeStockItems || []).map((n, i) => (
                      <div
                        key={i}
                        className="flex justify-between bg-white/50 p-2 rounded border border-amber-100"
                      >
                        <span className="font-medium text-gray-700">
                          {n.productId}
                        </span>
                        <span className="text-red-600">
                          Mevcut: {n.available} / Satılan: {n.sold}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ÜRÜN LİSTESİ */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 print-table">
                <thead>
                  <tr className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                    <th className="pb-3 text-left">Ürün Detayı</th>
                    <th className="pb-3 text-center px-4">Birim / Miktar</th>
                    <th className="pb-3 text-right px-4">Birim Fiyat</th>
                    <th className="pb-3 text-right px-4">Net Tutar</th>
                    {isOfficial && (
                      <th className="pb-3 text-right px-4">KDV</th>
                    )}
                    <th className="pb-3 text-right pl-4">Genel Toplam</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {visibleItems.map((it) => (
                    <tr
                      key={it.id}
                      className="group hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                            <Layers size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-800 line-clamp-2">
                              {it.productName || "-"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 text-center px-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-600 font-medium">
                            {it.quantity}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase">
                            {it.unit}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 text-right text-sm text-gray-600 font-mono px-4">
                        {formatMoney(it.unitPrice || 0)}
                      </td>

                      <td className="py-4 text-right text-sm text-gray-600 font-mono px-4">
                        {formatMoney(it.net || 0)}
                      </td>

                      {isOfficial && (
                        <td className="py-4 text-right text-sm text-gray-500 font-mono px-4">
                          {formatMoney(it.vat || 0)}
                        </td>
                      )}

                      <td className="py-4 text-right text-sm font-bold text-gray-900 font-mono pl-4">
                        {formatMoney(it.total || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOPLAMLAR ALT ALAN */}
          <div className="bg-gray-50 p-6 md:p-8 border-t border-gray-100 print-no-bg">
            <div className="flex flex-col items-end gap-3">
              <div className="flex justify-between items-center w-full md:w-80 text-sm">
                <span className="text-gray-500">Ara Toplam (Net)</span>
                <span className="font-mono text-gray-700">
                  {formatMoney(sale.netTotal || 0)} TL
                </span>
              </div>

              {isOfficial && (
                <div className="flex justify-between items-center w-full md:w-80 text-sm border-b border-gray-200 pb-3">
                  <span className="text-gray-500">Toplam KDV</span>
                  <span className="font-mono text-gray-700">
                    {formatMoney(sale.vatTotal || 0)} TL
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center w-full md:w-80 pt-2 gap-4">
                <span className="text-lg font-bold text-gray-900 uppercase whitespace-nowrap">
                  Genel Toplam
                </span>
                <span className="text-2xl font-bold text-indigo-600 font-mono tracking-tighter whitespace-nowrap">
                  {formatMoney(sale.grossTotal || 0)}
                  <span className="text-sm ml-2">TL</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-gray-400 text-center uppercase tracking-widest print-footer-note">
          Bu belge sistem tarafından otomatik oluşturulmuştur.
        </div>
      </div>
    </>
  );
}