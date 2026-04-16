// app/satissitok/admin/purchases/new/components/PurchaseItemsTable.jsx
"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { Boxes, Plus, Search, Trash2 } from "lucide-react";
import {
  buildLatestCostIndex,
  listProductCostEntries,
} from "@/app/satissitok/services/inventoryCostService";
import { buildProductSnapshot } from "@/app/satissitok/services/inventoryCatalogService";

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function fmt(n) {
  const x = num(n);
  return x.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function productLabel(p) {
  const name = (p?.name || "-").trim();
  const sku = (p?.sku || p?.stockCode || p?.code || "").trim();
  const unit = (p?.unit || "").trim();
  return `${name}${sku ? ` • ${sku}` : ""}${unit ? ` • ${unit}` : ""}`;
}

function makeEmptyRow() {
  return {
    productId: "",
    productName: "",
    productSnapshot: null,
    sku: "",
    unit: "",
    qty: 1,
    unitPrice: 0,

    netUnitPrice: 0,
    vatUnitPrice: 0,
    grossUnitPrice: 0,

    netLineTotal: 0,
    vatLineTotal: 0,
    grossLineTotal: 0,

    // ✅ yeni meta alanlar
    priceSource: "auto",
    lastPurchaseUnitPrice: 0,
    lastPurchaseDate: "",
    lastPurchaseDocNo: "",
  };
}

function normalizeText(v) {
  return String(v || "").trim().toLowerCase();
}

function filterProducts(products, queryText) {
  const q = normalizeText(queryText);
  return (products || []).filter((p) => {
    if (!q) return true;
    return (
      normalizeText(productLabel(p)).includes(q) ||
      normalizeText(p?.id).includes(q) ||
      normalizeText(p?.sku || p?.stockCode || p?.code).includes(q) ||
      normalizeText(p?.barcode).includes(q)
    );
  });
}

function getDateMs(v) {
  if (!v) return 0;

  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  }

  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? 0 : v.getTime();
  }

  if (typeof v === "number") return v;

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatDateTR(v) {
  const ms = getDateMs(v);
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("tr-TR");
}

function getPurchaseItems(doc) {
  if (Array.isArray(doc?.items)) return doc.items;
  if (Array.isArray(doc?.lines)) return doc.lines;
  if (Array.isArray(doc?.products)) return doc.products;
  return [];
}

function getPurchaseSupplierId(doc) {
  return (
    doc?.supplierId ||
    doc?.cariId ||
    doc?.vendorId ||
    doc?.supplier?.id ||
    doc?.cari?.id ||
    ""
  );
}

function getPurchaseSupplierName(doc) {
  return (
    doc?.supplierName ||
    doc?.cariName ||
    doc?.vendorName ||
    doc?.supplier?.name ||
    doc?.cari?.name ||
    ""
  );
}

function getPurchaseDocNo(doc) {
  return (
    doc?.invoiceNo ||
    doc?.docNo ||
    doc?.documentNo ||
    doc?.purchaseNo ||
    doc?.purchaseNumber ||
    ""
  );
}

function getPurchaseDateValue(doc) {
  return (
    doc?.invoiceDate ||
    doc?.date ||
    doc?.createdAt ||
    doc?.updatedAt ||
    null
  );
}

function getPurchaseStatus(doc) {
  return normalizeText(doc?.status || doc?.state || "");
}

function getItemProductId(item) {
  return String(item?.productId || item?.id || "").trim();
}

function getItemUnitPrice(item) {
  const price =
    item?.unitPrice ??
    item?.purchaseUnitPrice ??
    item?.lastPurchaseUnitPrice ??
    item?.costPrice ??
    item?.price ??
    0;

  return round2(num(price));
}

function isValidCompletedPurchase(doc) {
  const status = getPurchaseStatus(doc);

  // status hiç yoksa da eski kayıtları kaçırmamak için geçerli kabul ediyoruz
  if (!status) return true;

  // taslak / iptal / silinmiş benzeri kayıtları dışarıda bırak
  if (
    status === "draft" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "deleted"
  ) {
    return false;
  }

  // tamamlanmış / kaydedilmiş / gönderilmiş benzeri durumlar geçerli
  return true;
}

export default function PurchaseItemsTable({
  onChange,
  vatRate = 0,
  vatMode = "inclusive",
  hideVat = false,
  disabled = false,
  initialItems = [],
  supplierId = "",
  supplierName = "",
}) {
  const [products, setProducts] = useState([]);
  const [costEntries, setCostEntries] = useState([]);
  const [items, setItems] = useState([makeEmptyRow()]);

  const [openIndex, setOpenIndex] = useState(-1);
  const [ddPos, setDdPos] = useState({ top: 0, left: 0, width: 0 });
  const [queryByIndex, setQueryByIndex] = useState({});
  const inputRefs = useRef({});
  const closeTimerRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const [productsResult, costEntriesResult] = await Promise.allSettled([
        getDocs(collection(db, "products")),
        listProductCostEntries(),
      ]);

      if (productsResult.status === "fulfilled") {
        setProducts(productsResult.value.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else {
        console.warn("Products load skipped:", productsResult.reason);
        setProducts([]);
      }

      if (costEntriesResult.status === "fulfilled") {
        setCostEntries(costEntriesResult.value);
      } else {
        console.warn("Cost entries load skipped:", costEntriesResult.reason);
        setCostEntries([]);
      }
    };

    load();
  }, []);

  useEffect(() => {
    onChange(items);
  }, [items, onChange]);

  const calcRow = (row) => {
    const qty = num(row.qty);
    const unitPrice = num(row.unitPrice);

    if (hideVat === true) {
      row.netUnitPrice = round2(unitPrice);
      row.vatUnitPrice = 0;
      row.grossUnitPrice = round2(unitPrice);

      row.netLineTotal = round2(qty * unitPrice);
      row.vatLineTotal = 0;
      row.grossLineTotal = round2(qty * unitPrice);
      return;
    }

    const r = num(vatRate || 0);
    const factor = 1 + r / 100;

    let netUnit = 0;
    let vatUnit = 0;
    let grossUnit = 0;

    if (vatMode === "exclusive") {
      netUnit = unitPrice;
      vatUnit = unitPrice * (r / 100);
      grossUnit = netUnit + vatUnit;
    } else {
      grossUnit = unitPrice;
      netUnit = grossUnit / factor;
      vatUnit = grossUnit - netUnit;
    }

    row.netUnitPrice = round2(netUnit);
    row.vatUnitPrice = round2(vatUnit);
    row.grossUnitPrice = round2(grossUnit);

    row.netLineTotal = round2(qty * row.netUnitPrice);
    row.vatLineTotal = round2(qty * row.vatUnitPrice);
    row.grossLineTotal = round2(qty * row.grossUnitPrice);
  };

  function normalizeRow(row) {
    const normalized = {
      productId: row?.productId || "",
      productName: row?.productName || "",
      productSnapshot: row?.productSnapshot || null,
      sku: row?.sku || row?.stockCode || row?.code || "",
      unit: row?.unit || "",
      qty: Math.max(0, num(row?.qty ?? row?.quantity ?? 1)) || 1,
      unitPrice: Math.max(0, num(row?.unitPrice || 0)),

      netUnitPrice: num(row?.netUnitPrice || 0),
      vatUnitPrice: num(row?.vatUnitPrice || 0),
      grossUnitPrice: num(row?.grossUnitPrice || 0),

      netLineTotal: num(row?.netLineTotal ?? row?.net ?? 0),
      vatLineTotal: num(row?.vatLineTotal ?? row?.vat ?? 0),
      grossLineTotal: num(row?.grossLineTotal ?? row?.total ?? 0),

      priceSource: row?.priceSource || "auto",
      lastPurchaseUnitPrice: num(row?.lastPurchaseUnitPrice || 0),
      lastPurchaseDate: row?.lastPurchaseDate || "",
      lastPurchaseDocNo: row?.lastPurchaseDocNo || "",
    };

    calcRow(normalized);
    return normalized;
  }

  useEffect(() => {
    if (Array.isArray(initialItems) && initialItems.length > 0) {
      const normalized = initialItems.map((row) => normalizeRow(row));
      setItems(normalized);

      const nextQueries = {};
      normalized.forEach((row, i) => {
        nextQueries[i] = row.productName || row.sku || "";
      });
      setQueryByIndex(nextQueries);
      return;
    }

    setItems((prev) => {
      if (Array.isArray(prev) && prev.length > 0) return prev;
      return [makeEmptyRow()];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItems]);

  useEffect(() => {
    setItems((prev) =>
      (prev || []).map((row) => {
        const x = { ...row };
        calcRow(x);
        return x;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vatRate, vatMode, hideVat]);

  const addRow = () => {
    setItems((prev) => [...prev, makeEmptyRow()]);
  };

  const removeRow = (i) => {
    setItems((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [makeEmptyRow()];
    });

    setQueryByIndex((prev) => {
      const next = {};
      const oldEntries = Object.entries(prev)
        .map(([k, v]) => [Number(k), v])
        .filter(([k]) => k !== i)
        .sort((a, b) => a[0] - b[0]);

      oldEntries.forEach(([_, value], newIdx) => {
        next[newIdx] = value;
      });

      return next;
    });

    if (openIndex === i) setOpenIndex(-1);
  };

  const patchRow = (i, patch) => {
    setItems((prev) => {
      const x = [...prev];
      x[i] = { ...x[i], ...patch };
      calcRow(x[i]);
      return x;
    });
  };

  const currentRowLabel = (row) =>
    (row?.productName || "").trim() || (row?.sku ? `${row.sku}` : "") || "";

  const setQuery = (i, v) => setQueryByIndex((prev) => ({ ...prev, [i]: v }));

  const updateDdPosForIndex = (i) => {
    const el = inputRefs.current?.[i];
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDdPos({
      top: r.bottom + 6,
      left: r.left,
      width: r.width,
    });
  };

  const closeDropdownSoon = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpenIndex(-1), 150);
  };

  const latestCostIndex = useMemo(() => buildLatestCostIndex(costEntries), [costEntries]);

  const findLatestPurchaseInfo = ({ productId, supplierId, supplierName }) => {
    const targetProductId = String(productId || "").trim();
    if (!targetProductId) return null;

    const supplierKey = String(supplierId || "").trim();
    const supplierNameKey = String(supplierName || "").trim().toLowerCase();

    const entry =
      (supplierKey
        ? latestCostIndex[`${targetProductId}__supplier:${supplierKey}`]
        : null) ||
      (supplierNameKey
        ? latestCostIndex[`${targetProductId}__name:${supplierNameKey}`]
        : null) ||
      latestCostIndex[`${targetProductId}__default`] ||
      null;

    if (!entry) return null;

    return {
      unitPrice: round2(num(entry.grossUnitCost ?? entry.unitPrice)),
      dateValue: entry.documentDate || entry.createdAt || null,
      dateMs: getDateMs(entry.documentDate || entry.createdAt || null),
      docNo: entry.invoiceNo || "",
    };
  };

  const pickProduct = (i, p) => {
    const sku = (p?.sku || p?.stockCode || p?.code || "").trim();

    const latest = findLatestPurchaseInfo({
      productId: p.id,
      supplierId,
      supplierName,
    });

    patchRow(i, {
      productId: p.id,
      productName: (p?.name || "").trim(),
      sku,
      unit: (p?.unit || "").trim(),
      productSnapshot: buildProductSnapshot(p),
      unitPrice: latest ? num(latest.unitPrice) : 0,

      priceSource: "auto",
      lastPurchaseUnitPrice: latest ? num(latest.unitPrice) : 0,
      lastPurchaseDate: latest ? formatDateTR(latest.dateValue) : "",
      lastPurchaseDocNo: latest?.docNo || "",
    });

    setQuery(i, productLabel(p));
    setOpenIndex(-1);
  };

  // ✅ tedarikçi değişirse manuel olmayan satırları yeniden fiyatlandır
  useEffect(() => {
    if (!supplierId && !supplierName) return;
    if (!Array.isArray(items) || items.length === 0) return;

    setItems((prev) =>
      prev.map((row) => {
        if (!row?.productId) return row;
        if (row?.priceSource === "manual") return row;

        const latest = findLatestPurchaseInfo({
          productId: row.productId,
          supplierId,
          supplierName,
        });

        const next = {
          ...row,
          unitPrice: latest ? num(latest.unitPrice) : 0,
          priceSource: "auto",
          lastPurchaseUnitPrice: latest ? num(latest.unitPrice) : 0,
          lastPurchaseDate: latest ? formatDateTR(latest.dateValue) : "",
          lastPurchaseDocNo: latest?.docNo || "",
        };

        calcRow(next);
        return next;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, supplierName, latestCostIndex]);

  useEffect(() => {
    if (openIndex < 0) return;

    const onMove = () => updateDdPosForIndex(openIndex);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [openIndex]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (disabled) return;
      if (event.key === "Insert" || (event.altKey && event.key.toLowerCase() === "n")) {
        event.preventDefault();
        addRow();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled]);

  const vatLabel = hideVat ? "0%" : `${num(vatRate || 0)}%`;

  const totalQty = useMemo(
    () => items.reduce((s, r) => s + num(r.qty), 0),
    [items]
  );
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2 text-[#135bec]">
          <Boxes size={20} />
          <h2 className="text-lg font-bold text-slate-900">Satır Öğeleri</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] text-slate-500 font-bold">
            Satır: {items.length} • Toplam Adet: {fmt(totalQty)}
          </div>
          <button
            type="button"
            onClick={addRow}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-[#135bec] rounded-lg text-xs font-bold hover:bg-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Satır Ekle
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4 w-12 text-center">#</th>
              <th className="px-4 py-4 min-w-[320px]">Ürün / SKU</th>
              <th className="px-4 py-4 w-24">Miktar</th>
              <th className="px-4 py-4 w-24">Birim</th>
              <th className="px-4 py-4 w-44 text-right">Birim Maliyet (₸)</th>
              <th className="px-4 py-4 w-24 text-right">KDV %</th>
              <th className="px-4 py-4 w-44 text-right">Toplam (₸)</th>
              <th className="px-6 py-4 w-12"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {items.map((row, i) => (
              <tr
                key={i}
                className="group hover:bg-slate-50/50 transition-colors align-top"
              >
                <td className="px-6 py-4 text-xs text-slate-400 font-mono text-center">
                  {String(i + 1).padStart(2, "0")}
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="relative">
                      <input
                        ref={(el) => (inputRefs.current[i] = el)}
                        className="w-full text-sm font-bold bg-transparent border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={queryByIndex[i] ?? currentRowLabel(row)}
                        onFocus={() => {
                          updateDdPosForIndex(i);
                          if (queryByIndex[i] == null) setQuery(i, currentRowLabel(row));
                          setOpenIndex(i);
                        }}
                        onChange={(e) => {
                          updateDdPosForIndex(i);
                          const v = e.target.value;
                          setQuery(i, v);
                          setOpenIndex(i);

                          if (!v) {
                            patchRow(i, {
                              productId: "",
                              productName: "",
                              productSnapshot: null,
                              sku: "",
                              unit: "",
                              unitPrice: 0,
                              netUnitPrice: 0,
                              vatUnitPrice: 0,
                              grossUnitPrice: 0,
                              netLineTotal: 0,
                              vatLineTotal: 0,
                              grossLineTotal: 0,
                              priceSource: "auto",
                              lastPurchaseUnitPrice: 0,
                              lastPurchaseDate: "",
                              lastPurchaseDocNo: "",
                            });
                          }
                        }}
                        onBlur={() => closeDropdownSoon()}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setOpenIndex(-1);

                          if (e.key === "Enter") {
                            e.preventDefault();
                            const q = String(queryByIndex[i] ?? currentRowLabel(row))
                              .trim()
                              .toLowerCase();

                            const list = filterProducts(products, q).slice(0, 1);

                            if (list[0]) pickProduct(i, list[0]);
                          }
                        }}
                        placeholder="Ürün ara / seç…"
                        disabled={disabled}
                      />

                      {openIndex === i && (
                        <div
                          className="fixed z-[9999] max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                          style={{
                            top: ddPos.top,
                            left: ddPos.left,
                            width: Math.max(420, ddPos.width),
                          }}
                        >
                          {(() => {
                            const q = String(queryByIndex[i] ?? currentRowLabel(row))
                              .trim()
                              .toLowerCase();

                            const list = filterProducts(products, q).slice(0, 80);

                            if (!list.length) {
                              return (
                                <div className="px-3 py-2 text-sm text-slate-500">
                                  Sonuç yok
                                </div>
                              );
                            }

                            return list.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickProduct(i, p)}
                              >
                                <div className="font-medium">{productLabel(p)}</div>
                                <div className="text-[11px] text-slate-400">
                                  SKU: {p?.sku || p?.stockCode || p?.code || p.id || "-"}
                                  {p?.price != null ? ` • Satis: ${fmt(p.price)}` : ""}
                                </div>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono">
                      SKU: {row.sku || row.productId || "-"}
                    </span>

                    {(row.lastPurchaseDate || row.lastPurchaseDocNo || num(row.lastPurchaseUnitPrice) > 0) && (
                      <span className="text-[10px] text-emerald-600 font-mono">
                        Son alış: {fmt(row.lastPurchaseUnitPrice)}{" "}
                        {row.lastPurchaseDate ? `• ${row.lastPurchaseDate}` : ""}
                        {row.lastPurchaseDocNo ? ` • ${row.lastPurchaseDocNo}` : ""}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-2 text-sm text-center focus:border-[#135bec] focus:ring-0"
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.qty}
                    disabled={disabled}
                    onChange={(e) => patchRow(i, { qty: e.target.value })}
                  />
                </td>

                <td className="px-4 py-4">
                  <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2 py-1 rounded">
                    {row.unit || "-"}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col items-end gap-1">
                    <input
                      className="w-full bg-transparent border-none p-0 text-sm font-mono font-bold text-right focus:ring-0"
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.unitPrice}
                      disabled={disabled}
                      onChange={(e) =>
                        patchRow(i, {
                          unitPrice: e.target.value,
                          priceSource: "manual",
                        })
                      }
                      placeholder="0"
                    />
                    <div className="text-[10px] text-slate-400 font-mono">
                      Net: {fmt(row.netUnitPrice)} • KDV: {fmt(row.vatUnitPrice)}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4 text-right">
                  <span className="text-xs font-bold text-slate-500">{vatLabel}</span>
                </td>

                <td className="px-4 py-4 text-right font-mono font-bold text-sm text-slate-900">
                  {fmt(row.grossLineTotal)}
                </td>

                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={disabled}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Satırı sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}

            <tr className="bg-slate-50/30">
              <td className="px-4 py-3" colSpan={8}>
                <div className="flex items-center gap-4 w-full">
                  <div className="flex-grow relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Search size={16} />
                    </span>
                    <input
                      className="w-full bg-white border-dashed border-slate-300 border rounded-lg py-2 pl-9 pr-4 text-xs font-medium focus:ring-[#135bec] focus:border-[#135bec]"
                      placeholder="Eklemek için ürün arayın... (Satır Ekle ile başlat)"
                      type="text"
                      disabled={disabled}
                      onFocus={() => {
                        if (items.length === 0) addRow();
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">
                    veya{" "}
                    <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] shadow-sm font-mono font-bold">
                      INS
                    </kbd>{" "}
                    tuşu
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
