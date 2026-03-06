// app/satissitok/admin/reports/vat/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";

function money(n) {
  return Number(n || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function normalizeDateRange(filterType, fromDate, toDate) {
  let start;
  let end = new Date();

  if (filterType === "today") {
    start = startOfToday();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (filterType === "month") {
    start = startOfMonth();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (!fromDate || !toDate) return null;

  start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(esc).join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Item-level KDV kırılımı:
 * - item.vatRate / item.taxRate / item.vatPercent -> rate
 * - item.vatAmount / item.tax / item.vat -> vat
 * Yoksa doc-level fallback kullanılır.
 */
function extractVatRate(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function pickItemRate(it) {
  return (
    extractVatRate(it?.vatRate) ??
    extractVatRate(it?.taxRate) ??
    extractVatRate(it?.vatPercent) ??
    null
  );
}
function pickItemVat(it) {
  return num(it?.vatAmount ?? it?.tax ?? it?.vat ?? 0);
}

export default function VatReportPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary"); // summary | sales | purchases

  const [salesRows, setSalesRows] = useState([]);
  const [purchaseRows, setPurchaseRows] = useState([]);

  const [salesSummary, setSalesSummary] = useState({ net: 0, vat: 0, gross: 0, count: 0 });
  const [purchaseSummary, setPurchaseSummary] = useState({ net: 0, vat: 0, gross: 0, count: 0 });

  const [error, setError] = useState("");

  const [filterType, setFilterType] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const payableVat = useMemo(() => num(salesSummary.vat) - num(purchaseSummary.vat), [salesSummary.vat, purchaseSummary.vat]);
  const payableLabel = payableVat >= 0 ? "Ödenecek KDV" : "Devreden KDV";

  const salesByPlatform = useMemo(() => {
    const map = {};
    for (const r of salesRows) {
      const k = String(r.platform || "other");
      if (!map[k]) map[k] = { vat: 0, gross: 0, count: 0 };
      map[k].vat += num(r.vat);
      map[k].gross += num(r.gross);
      map[k].count += 1;
    }
    return Object.entries(map)
      .map(([platform, v]) => ({ platform, ...v }))
      .sort((a, b) => b.vat - a.vat);
  }, [salesRows]);

  const vatRateBreakdown = useMemo(() => {
    const map = {};
    const ensure = (rate) => {
      const k = rate == null ? "unknown" : String(rate);
      if (!map[k]) map[k] = { rate: k, outVat: 0, inVat: 0 };
      return map[k];
    };

    // sales: item-level varsa item vat dağıt; yoksa doc vatRate ile doc vat
    for (const s of salesRows) {
      const items = Array.isArray(s.items) ? s.items : null;
      if (items?.length) {
        for (const it of items) {
          const rate = pickItemRate(it) ?? s.vatRate ?? null;
          const vat = pickItemVat(it);
          ensure(rate).outVat += vat;
        }
      } else {
        ensure(s.vatRate ?? null).outVat += num(s.vat);
      }
    }

    // purchases
    for (const p of purchaseRows) {
      const items = Array.isArray(p.items) ? p.items : null;
      if (items?.length) {
        for (const it of items) {
          const rate = pickItemRate(it) ?? p.vatRate ?? null;
          const vat = pickItemVat(it);
          ensure(rate).inVat += vat;
        }
      } else {
        ensure(p.vatRate ?? null).inVat += num(p.vat);
      }
    }

    return Object.values(map).sort(
      (a, b) => num(b.outVat + b.inVat) - num(a.outVat + a.inVat)
    );
  }, [salesRows, purchaseRows]);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReport() {
    setLoading(true);
    setError("");

    const range = normalizeDateRange(filterType, fromDate, toDate);
    if (!range) {
      alert("Tarih aralığını seç");
      setLoading(false);
      return;
    }

    const { start, end } = range;
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    try {
      // ✅ orderBy yok: index ihtiyacı daha az
      const salesQ = query(
        collection(db, "sales"),
        where("status", "==", "completed"),
        where("saleType", "==", "official"),
        where("createdAt", ">=", startTs),
        where("createdAt", "<=", endTs)
      );

      const purchasesQ = query(
        collection(db, "purchases"),
        where("status", "==", "completed"),
        where("purchaseType", "==", "official"),
        where("createdAt", ">=", startTs),
        where("createdAt", "<=", endTs)
      );

      const [salesSnap, purchasesSnap] = await Promise.all([getDocs(salesQ), getDocs(purchasesQ)]);

      // SALES
      let sNet = 0, sVat = 0, sGross = 0, sCount = 0;
      const sTable = [];
      salesSnap.forEach((d) => {
        const s = d.data();
        const net = num(s.netTotal);
        const vat = num(s.vatTotal);
        const gross = num(s.grossTotal);

        sNet += net;
        sVat += vat;
        sGross += gross;
        sCount += 1;

        sTable.push({
          id: d.id,
          saleNo: s.saleNo || s.invoiceNo || "-",
          net,
          vat,
          gross,
          platform: s.saleChannel || s.platformId || "other",
          vatRate: s.vatRate ?? s.taxRate ?? null,
          createdAt: s.createdAt?.toDate ? s.createdAt.toDate() : null,
          items: Array.isArray(s.items) ? s.items : [],
        });
      });

      // PURCHASES
      let pNet = 0, pVat = 0, pGross = 0, pCount = 0;
      const pTable = [];
      purchasesSnap.forEach((d) => {
        const p = d.data();
        const net = num(p.netTotal ?? p.totals?.net);
        const vat = num(p.vatTotal ?? p.totals?.tax ?? p.totals?.vat);
        const gross = num(p.grossTotal ?? p.totals?.gross);

        pNet += net;
        pVat += vat;
        pGross += gross;
        pCount += 1;

        pTable.push({
          id: d.id,
          purchaseNo: p.invoiceNo || p.documentNo || "-",
          supplier: p.supplierName || p.companyName || "-",
          net,
          vat,
          gross,
          vatRate: p.taxRate ?? p.vatRate ?? null,
          createdAt: p.createdAt?.toDate ? p.createdAt.toDate() : null,
          items: Array.isArray(p.items) ? p.items : [],
        });
      });

      // client-side sort (en yeni üstte)
      sTable.sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
      pTable.sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));

      setSalesRows(sTable);
      setPurchaseRows(pTable);

      setSalesSummary({ net: round2(sNet), vat: round2(sVat), gross: round2(sGross), count: sCount });
      setPurchaseSummary({ net: round2(pNet), vat: round2(pVat), gross: round2(pGross), count: pCount });
    } catch (e) {
      const msg = String(e?.message || e || "Bilinmeyen hata");
      setError(msg);

      setSalesRows([]);
      setPurchaseRows([]);
      setSalesSummary({ net: 0, vat: 0, gross: 0, count: 0 });
      setPurchaseSummary({ net: 0, vat: 0, gross: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (activeTab === "sales") {
      const rows = salesRows.map((r) => ({
        saleNo: r.saleNo,
        platform: r.platform,
        vatRate: r.vatRate ?? "",
        net: r.net,
        vat: r.vat,
        gross: r.gross,
      }));
      downloadText(`vat_sales_${stamp}.csv`, toCSV(rows));
      return;
    }

    if (activeTab === "purchases") {
      const rows = purchaseRows.map((r) => ({
        purchaseNo: r.purchaseNo,
        supplier: r.supplier,
        vatRate: r.vatRate ?? "",
        net: r.net,
        vat: r.vat,
        gross: r.gross,
      }));
      downloadText(`vat_purchases_${stamp}.csv`, toCSV(rows));
      return;
    }

    const rows = [
      { label: "Satış Net", value: salesSummary.net },
      { label: "Satış KDV (Çıkan)", value: salesSummary.vat },
      { label: "Satış Brüt", value: salesSummary.gross },
      { label: "Satınalma Net", value: purchaseSummary.net },
      { label: "Satınalma KDV (İndirilecek)", value: purchaseSummary.vat },
      { label: "Satınalma Brüt", value: purchaseSummary.gross },
      { label: payableLabel, value: Math.abs(payableVat) },
    ];
    downloadText(`vat_summary_${stamp}.csv`, toCSV(rows));
  }

  if (loading) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="p-6 space-y-6">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">KDV Raporu</h1>
        <button onClick={exportCSV} className="px-3 py-2 border rounded hover:bg-gray-50">
          CSV Export
        </button>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 p-3 rounded text-sm">
          <div className="font-semibold mb-1">Firestore Hatası</div>
          <div className="whitespace-pre-wrap">{error}</div>
          <div className="mt-2">
            Büyük ihtimalle <b>composite index</b> eksik. Konsoldaki hata linkine tıklayıp “Create index” oluştur.
          </div>
        </div>
      )}

      {/* FİLTRE */}
      <div className="flex flex-wrap gap-4 items-end border p-4">
        <div>
          <label className="block text-sm">Filtre</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border p-2">
            <option value="today">Bugün</option>
            <option value="month">Bu Ay</option>
            <option value="custom">Özel Aralık</option>
          </select>
        </div>

        {filterType === "custom" && (
          <>
            <div>
              <label className="block text-sm">Başlangıç</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border p-2" />
            </div>
            <div>
              <label className="block text-sm">Bitiş</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border p-2" />
            </div>
          </>
        )}

        <button onClick={loadReport} className="px-4 py-2 bg-black text-white rounded">
          Uygula
        </button>
      </div>

      {/* TAB BAR */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={activeTab === "summary"} onClick={() => setActiveTab("summary")}>
          Özet
        </TabBtn>
        <TabBtn active={activeTab === "sales"} onClick={() => setActiveTab("sales")}>
          Satışlar (Çıkan KDV)
        </TabBtn>
        <TabBtn active={activeTab === "purchases"} onClick={() => setActiveTab("purchases")}>
          Satınalmalar (İndirilecek KDV)
        </TabBtn>
      </div>

      {/* SUMMARY */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Satış Net" value={money(salesSummary.net)} />
            <Card title="Satış KDV (Çıkan)" value={money(salesSummary.vat)} />
            <Card title="Satış Brüt" value={money(salesSummary.gross)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Satınalma Net" value={money(purchaseSummary.net)} />
            <Card title="Satınalma KDV (İndirilecek)" value={money(purchaseSummary.vat)} />
            <Card title="Satınalma Brüt" value={money(purchaseSummary.gross)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title={payableLabel} value={money(Math.abs(payableVat))} emphasize />
            <Card title="Satış Adet" value={String(salesSummary.count)} />
            <Card title="Satınalma Adet" value={String(purchaseSummary.count)} />
          </div>

          {/* BREAKDOWNS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded">
              <div className="p-3 font-semibold border-b">Satış Platform Kırılımı (KDV)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 text-left">Platform</th>
                      <th className="border p-2 text-right">KDV</th>
                      <th className="border p-2 text-right">Brüt</th>
                      <th className="border p-2 text-right">Adet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesByPlatform.map((x) => (
                      <tr key={x.platform}>
                        <td className="border p-2">{x.platform}</td>
                        <td className="border p-2 text-right">{money(x.vat)}</td>
                        <td className="border p-2 text-right">{money(x.gross)}</td>
                        <td className="border p-2 text-right">{x.count}</td>
                      </tr>
                    ))}
                    {!salesByPlatform.length && (
                      <tr>
                        <td className="border p-3 text-center text-gray-500" colSpan={4}>
                          Kayıt yok
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border rounded">
              <div className="p-3 font-semibold border-b">KDV Oranı Kırılımı (Çıkan / İndirilecek)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 text-left">Oran</th>
                      <th className="border p-2 text-right">Çıkan KDV</th>
                      <th className="border p-2 text-right">İndirilecek KDV</th>
                      <th className="border p-2 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatRateBreakdown.map((x) => (
                      <tr key={x.rate}>
                        <td className="border p-2">{x.rate}</td>
                        <td className="border p-2 text-right">{money(x.outVat)}</td>
                        <td className="border p-2 text-right">{money(x.inVat)}</td>
                        <td className="border p-2 text-right">{money(num(x.outVat) - num(x.inVat))}</td>
                      </tr>
                    ))}
                    {!vatRateBreakdown.length && (
                      <tr>
                        <td className="border p-3 text-center text-gray-500" colSpan={4}>
                          Kayıt yok
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALES TABLE */}
      {activeTab === "sales" && (
        <div className="overflow-x-auto border rounded">
          <div className="p-3 font-semibold border-b">Satış Detayları (Resmi + Completed)</div>
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Satış No</th>
                <th className="border p-2">Platform</th>
                <th className="border p-2 text-right">Net</th>
                <th className="border p-2 text-right">KDV</th>
                <th className="border p-2 text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2">{r.saleNo}</td>
                  <td className="border p-2">{r.platform}</td>
                  <td className="border p-2 text-right">{money(r.net)}</td>
                  <td className="border p-2 text-right">{money(r.vat)}</td>
                  <td className="border p-2 text-right">{money(r.gross)}</td>
                </tr>
              ))}
              {!salesRows.length && (
                <tr>
                  <td className="border p-3 text-center text-gray-500" colSpan={5}>
                    Kayıt yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PURCHASES TABLE */}
      {activeTab === "purchases" && (
        <div className="overflow-x-auto border rounded">
          <div className="p-3 font-semibold border-b">Satınalma Detayları (Resmi + Completed)</div>
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Fatura No</th>
                <th className="border p-2">Tedarikçi</th>
                <th className="border p-2 text-right">Net</th>
                <th className="border p-2 text-right">KDV</th>
                <th className="border p-2 text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRows.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2">{r.purchaseNo}</td>
                  <td className="border p-2">{r.supplier}</td>
                  <td className="border p-2 text-right">{money(r.net)}</td>
                  <td className="border p-2 text-right">{money(r.vat)}</td>
                  <td className="border p-2 text-right">{money(r.gross)}</td>
                </tr>
              ))}
              {!purchaseRows.length && (
                <tr>
                  <td className="border p-3 text-center text-gray-500" colSpan={5}>
                    Kayıt yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-2 rounded border text-sm " +
        (active ? "bg-black text-white border-black" : "hover:bg-gray-50")
      }
    >
      {children}
    </button>
  );
}

function Card({ title, value, emphasize = false }) {
  return (
    <div className={"border rounded p-4 " + (emphasize ? "bg-green-50 border-green-200" : "")}>
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}