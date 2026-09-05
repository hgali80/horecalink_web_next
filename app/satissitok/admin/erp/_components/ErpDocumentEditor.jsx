"use client";

import ErpCashAccountSelect from "./ErpCashAccountSelect";

import { Fragment, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, CopyPlus, PlusCircle, Search, Trash2, X } from "lucide-react";
import { listErpCariOptions } from "../_services/erpCarisService";
import { getCounterPreview } from "../_services/erpCounterService";
import { getErpDocument } from "../_services/erpDocumentsService";
import {
  confirmErpDocument,
  saveErpDraftDocument,
} from "../_services/erpDocumentMutationService";
import { listErpCashAccountOptions } from "../_services/erpFinanceService";
import {
  getErpPriceMemoryDataset,
  resolveErpPurchasePriceHints,
  resolveErpSalesPriceHints,
} from "../_services/erpPriceMemoryService";
import { listErpProductOptions } from "../_services/erpProductsService";
import { getErpSettings } from "../_services/erpSettingsService";
import { listErpStockBalances } from "../_services/erpStockService";
import ErpSalesPdfButton from "./ErpSalesPdfButton";

function text(value) {
  return String(value ?? "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(num(value, 0) * 100) / 100;
}

function fmtMoney(value) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPercent(value) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function fmtQty(value) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function defaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function newRowId() {
  return `row_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyItem(defaultBucket) {
  return {
    rowId: newRowId(),
    productId: "",
    productSku: "",
    productName: "",
    unit: "adet",
    quantity: 1,
    unitPrice: 0,
    stockSourceType: defaultBucket,
    stockTracked: true,
    webPublished: false,
    manualUnitCost: "",
    notes: "",
  };
}

function allocateAdditionalCost(items = [], additionalCostTotal = 0) {
  const rows = Array.isArray(items) ? items : [];
  const extraTotal = round2(additionalCostTotal);
  const baseTotal = round2(rows.reduce((sum, item) => sum + num(item.lineTotal, 0), 0));

  if (!rows.length || extraTotal <= 0 || baseTotal <= 0) {
    return rows.map((item) => ({
      ...item,
      allocatedAdditionalCost: 0,
      effectiveLineCost: round2(item.baseCostLineTotal),
      effectiveUnitCost:
        num(item.quantity, 0) > 0 ? round2(num(item.baseCostLineTotal, 0) / num(item.quantity, 0)) : round2(item.baseCostUnit),
    }));
  }

  let distributed = 0;
  return rows.map((item, index) => {
    const share =
      index === rows.length - 1
        ? round2(extraTotal - distributed)
        : round2((num(item.lineTotal, 0) / baseTotal) * extraTotal);
    distributed = round2(distributed + share);
    const effectiveLineCost = round2(num(item.baseCostLineTotal, 0) + share);
    return {
      ...item,
      allocatedAdditionalCost: share,
      effectiveLineCost,
      effectiveUnitCost:
        num(item.quantity, 0) > 0 ? round2(effectiveLineCost / num(item.quantity, 0)) : round2(item.baseCostUnit),
    };
  });
}

function resolveStockCost(balance, bucket) {
  const current = balance || {};
  const preferredAvg = bucket === "F" ? num(current.fAvgCost, 0) : num(current.rAvgCost, 0);
  const preferredQty = bucket === "F" ? num(current.fQty, 0) : num(current.rQty, 0);
  const fallbackAvg = bucket === "F" ? num(current.rAvgCost, 0) : num(current.fAvgCost, 0);
  const fallbackBucket = bucket === "F" ? "R" : "F";

  if (preferredQty > 0 && preferredAvg > 0) {
    return { unitCost: round2(preferredAvg), source: bucket, fallback: false };
  }

  if (preferredAvg > 0) {
    return { unitCost: round2(preferredAvg), source: bucket, fallback: false };
  }

  if (fallbackAvg > 0) {
    return { unitCost: round2(fallbackAvg), source: fallbackBucket, fallback: true };
  }

  return { unitCost: 0, source: bucket, fallback: false };
}

function mergeableKey(item) {
  return [
    text(item.productId),
    round2(item.unitPrice),
    text(item.stockSourceType || "R"),
    round2(item.manualUnitCost),
  ].join("__");
}

function buildProductSeed(product, docType) {
  return {
    rowId: newRowId(),
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    unit: product.unit || "adet",
    quantity: 1,
    unitPrice: num(product.price, 0),
    stockSourceType: docType,
    stockTracked: product.stockTracked !== false,
    webPublished: product.webPublished === true,
    manualUnitCost: "",
    notes: "",
  };
}

function filterProducts(products = [], query, isSales) {
  const needle = normalizeSearchText(query);
  return (Array.isArray(products) ? products : [])
    .filter((item) => {
      if (isSales && item.saleEnabled === false) return false;
      if (!isSales && item.purchaseEnabled === false) return false;
      if (!needle) return true;

      const haystack = normalizeSearchText(
        [
          item.name,
          item.nameTr,
          item.nameRu,
          item.sku,
          item.brand,
          item.barcode,
          item.searchText,
        ].join(" ")
      );
      return haystack.includes(needle);
    })
    .slice(0, 80);
}

export default function ErpDocumentEditor({ kind, documentId = "" }) {
  const router = useRouter();
  const isSales = kind === "sales";
  const isEditMode = text(documentId) !== "";
  const title = isSales
    ? isEditMode
      ? "Satis Belgesini Duzenle"
      : "Yeni Satis Belgesi"
    : isEditMode
      ? "Satinalma Belgesini Duzenle"
      : "Yeni Satinalma Belgesi";
  const actionLabel = isSales ? "Tahsilat" : "Odeme";
  const additionalCostLabel = isSales ? "Satis Ek Maliyeti" : "Satinalma Ek Maliyeti";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState(null);
  const [cariOptions, setCariOptions] = useState([]);
  const [accountOptions, setAccountOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [stockBalanceMap, setStockBalanceMap] = useState(new Map());
  const [priceMemory, setPriceMemory] = useState({ sales: [], purchases: [] });
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [separateLineMode, setSeparateLineMode] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [pickerState, setPickerState] = useState({ rowId: "", query: "" });
  const [previews, setPreviews] = useState({ draft: "", document: "", invoice: "" });
  const [loadedStatus, setLoadedStatus] = useState("");
  const [form, setForm] = useState({
    id: "",
    docType: "R",
    documentDate: defaultDate(),
    cariId: "",
    cariName: "",
    warehouseKey: "",
    platformKey: "",
    additionalCostTotal: "",
    items: [],
    documentNo: "",
    invoiceNo: "",
    instantPaymentEnabled: false,
    paymentMethod: "",
    accountId: "",
    paidAmount: "",
    paidDate: defaultDate(),
    notes: "",
  });

  const warehouseOptions = useMemo(() => settings?.warehouses || [], [settings]);
  const platformOptions = useMemo(() => settings?.salesPlatforms || [], [settings]);
  const paymentMethods = useMemo(() => settings?.paymentMethods || [], [settings]);
  const selectedProduct = useMemo(
    () => productOptions.find((item) => item.id === selectedProductId) || null,
    [productOptions, selectedProductId]
  );
  const pickerRow = useMemo(
    () => (pickerState.rowId ? (form.items || []).find((item) => item.rowId === pickerState.rowId) || null : null),
    [form.items, pickerState.rowId]
  );

  const filteredProducts = useMemo(
    () => filterProducts(productOptions, productQuery, isSales),
    [isSales, productOptions, productQuery]
  );
  const pickerProducts = useMemo(
    () => filterProducts(productOptions, pickerState.query, isSales),
    [isSales, pickerState.query, productOptions]
  );

  const calculatedItems = useMemo(() => {
    return (form.items || []).map((item) => {
      const quantity = num(item.quantity, 0);
      const unitPrice = num(item.unitPrice, 0);
      const stockSourceType = text(item.stockSourceType || form.docType).toUpperCase() === "F" ? "F" : "R";
      const balance = stockBalanceMap.get(text(item.productId)) || null;
      const stockCost = resolveStockCost(balance, stockSourceType);
      const manualUnitCost = isSales ? round2(item.manualUnitCost) : 0;
      const baseCostUnit = isSales
        ? manualUnitCost > 0
          ? manualUnitCost
          : stockCost.unitCost
        : round2(unitPrice);
      const baseCostLineTotal = round2(baseCostUnit * quantity);
      const lineTotal = round2(quantity * unitPrice);
      const salesHints = resolveErpSalesPriceHints({
        rows: priceMemory.sales,
        productId: item.productId,
        cariId: form.cariId,
        docType: form.docType,
      });
      const purchaseHints = resolveErpPurchasePriceHints({
        rows: priceMemory.purchases,
        productId: item.productId,
        cariId: form.cariId,
        docType: form.docType,
      });

      return {
        ...item,
        quantity,
        unitPrice,
        lineTotal,
        stockSourceType,
        manualUnitCost: manualUnitCost > 0 ? manualUnitCost : "",
        systemCostUnit: stockCost.unitCost,
        stockCostSource: stockCost.source,
        usedFallback: stockCost.fallback,
        baseCostUnit,
        baseCostLineTotal,
        salesHints,
        purchaseHints,
        balance,
      };
    });
  }, [form.cariId, form.docType, form.items, isSales, priceMemory.purchases, priceMemory.sales, stockBalanceMap]);

  const goodsTotal = useMemo(
    () => round2(calculatedItems.reduce((sum, item) => sum + num(item.lineTotal, 0), 0)),
    [calculatedItems]
  );
  const additionalCostTotal = useMemo(() => round2(form.additionalCostTotal), [form.additionalCostTotal]);
  const costedItems = useMemo(
    () => allocateAdditionalCost(calculatedItems, additionalCostTotal).map((item) => {
      const grossProfitLine = round2(num(item.lineTotal, 0) - num(item.baseCostLineTotal, 0));
      const netProfitLine = round2(num(item.lineTotal, 0) - num(item.effectiveLineCost, 0));
      return { ...item, grossProfitLine, netProfitLine };
    }),
    [additionalCostTotal, calculatedItems]
  );
  const documentTotal = useMemo(
    () => round2(isSales ? goodsTotal : goodsTotal + additionalCostTotal),
    [additionalCostTotal, goodsTotal, isSales]
  );
  const costOfGoods = useMemo(
    () => round2(costedItems.reduce((sum, item) => sum + num(item.baseCostLineTotal, 0), 0)),
    [costedItems]
  );
  const totalCost = useMemo(
    () => round2(costedItems.reduce((sum, item) => sum + num(item.effectiveLineCost, 0), 0)),
    [costedItems]
  );
  const grossProfit = useMemo(() => round2(goodsTotal - costOfGoods), [costOfGoods, goodsTotal]);
  const netProfit = useMemo(() => round2(goodsTotal - totalCost), [goodsTotal, totalCost]);
  const marginRate = useMemo(() => (goodsTotal > 0 ? round2((netProfit / goodsTotal) * 100) : 0), [goodsTotal, netProfit]);
  const totalPaid = round2(form.paidAmount);
  const remainingAmount = round2(Math.max(documentTotal - totalPaid, 0));

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const [nextSettings, nextCaris, nextAccounts, nextProducts, nextBalances, nextPriceMemory, existingDocument] = await Promise.all([
          getErpSettings(),
          listErpCariOptions(),
          listErpCashAccountOptions(),
          listErpProductOptions(),
          listErpStockBalances(),
          getErpPriceMemoryDataset(),
          isEditMode
            ? getErpDocument(isSales ? "erp_sales" : "erp_purchases", documentId)
            : Promise.resolve(null),
        ]);

        if (!alive) return;

        const defaultWarehouse = nextSettings.warehouses.find((item) => item.default) || nextSettings.warehouses[0];
        const defaultPlatform = nextSettings.salesPlatforms.find((item) => item.default) || nextSettings.salesPlatforms[0];
        const defaultPayment = nextSettings.paymentMethods.find((item) => item.default) || nextSettings.paymentMethods[0];

        setSettings(nextSettings);
        setCariOptions(nextCaris);
        setAccountOptions(nextAccounts || []);
        setProductOptions(nextProducts || []);
        setPriceMemory(nextPriceMemory);
        setStockBalanceMap(new Map((nextBalances || []).map((item) => [item.id, item])));
        setLoadedStatus(text(existingDocument?.status));
        setForm((current) => {
          if (existingDocument) {
            const sourceItems = Array.isArray(existingDocument.items) ? existingDocument.items : [];
            return {
              ...current,
              id: existingDocument.id,
              docType: existingDocument.docType || "R",
              documentDate: text(existingDocument.documentDate) || defaultDate(),
              cariId: text(existingDocument.cariId || existingDocument?.cariSnapshot?.id),
              cariName: text(existingDocument.cariName || existingDocument?.cariSnapshot?.name),
              warehouseKey: text(existingDocument.warehouseKey || defaultWarehouse?.key || ""),
              platformKey: text(existingDocument.platformKey || defaultPlatform?.key || ""),
              additionalCostTotal: String(num(existingDocument.additionalCostTotal, 0) || ""),
              items: sourceItems.length
                ? sourceItems.map((item) => ({
                    rowId: text(item.rowId) || newRowId(),
                    productId: text(item.productId),
                    productSku: text(item.productSku),
                    productName: text(item.productName),
                    unit: text(item.unit || "adet"),
                    quantity: num(item.quantity, 1),
                    unitPrice: num(item.unitPrice, 0),
                    stockSourceType: text(item.stockSourceType || existingDocument.docType || "R"),
                    stockTracked: item.stockTracked !== false,
                    webPublished: item.webPublished === true,
                    manualUnitCost: item?.manualUnitCost ? String(num(item.manualUnitCost, 0)) : "",
                    notes: text(item.notes),
                  }))
                : [emptyItem(existingDocument.docType || "R")],
              documentNo: text(existingDocument.documentNo),
              invoiceNo: text(existingDocument.invoiceNo),
              instantPaymentEnabled: existingDocument?.payment?.enabled === true,
              paymentMethod: text(existingDocument?.payment?.method || defaultPayment?.key || ""),
              accountId: text(existingDocument?.payment?.accountId || nextAccounts?.[0]?.value || ""),
              paidAmount: existingDocument?.payment?.paidAmount ? String(num(existingDocument.payment.paidAmount, 0)) : "",
              paidDate: text(existingDocument?.payment?.paidDate || existingDocument.documentDate || defaultDate()),
              notes: text(existingDocument.notes),
            };
          }

          return {
            ...current,
            warehouseKey: current.warehouseKey || defaultWarehouse?.key || "",
            platformKey: current.platformKey || defaultPlatform?.key || "",
            paymentMethod: current.paymentMethod || defaultPayment?.key || "",
            accountId: current.accountId || nextAccounts?.[0]?.value || "",
            items: current.items?.length ? current.items : [emptyItem(current.docType || "R")],
          };
        });
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Belge editoru icin gerekli veriler yuklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [documentId, isEditMode, isSales]);

  useEffect(() => {
    let alive = true;
    if (!settings) return;

    (async () => {
      try {
        const [draft, document, invoice] = await Promise.all([
          getCounterPreview({ settings, kind, docType: form.docType, counterType: "draft", dateISO: form.documentDate }),
          getCounterPreview({ settings, kind, docType: form.docType, counterType: "document", dateISO: form.documentDate }),
          getCounterPreview({ settings, kind, docType: form.docType, counterType: "invoice", dateISO: form.documentDate }),
        ]);
        if (!alive) return;
        setPreviews({ draft: draft.number, document: document.number, invoice: invoice.number });
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [form.docType, form.documentDate, kind, settings]);

  function getProductPurchaseHints(productId) {
    return resolveErpPurchasePriceHints({
      rows: priceMemory.purchases,
      productId,
      cariId: form.cariId,
      docType: form.docType,
    });
  }

  function getProductSalesHints(productId) {
    return resolveErpSalesPriceHints({
      rows: priceMemory.sales,
      productId,
      cariId: form.cariId,
      docType: form.docType,
    });
  }

  function resolveInitialUnitPrice(product) {
    if (!product?.id) return 0;
    if (isSales) {
      const salesHints = getProductSalesHints(product.id);
      return round2(salesHints.lastSaleByCari?.value ?? salesHints.lastSale?.value ?? num(product.price, 0));
    }

    const purchaseHints = getProductPurchaseHints(product.id);
    return round2(
      purchaseHints.lastPurchaseByCari?.value ??
        purchaseHints.lastPurchase?.value ??
        purchaseHints.lastPurchaseByDocType?.value ??
        0
    );
  }

  function createSeedFromProduct(product) {
    return {
      ...buildProductSeed(product, form.docType),
      unitPrice: resolveInitialUnitPrice(product),
    };
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateItem(rowId, field, value) {
    setForm((current) => ({
      ...current,
      items: (current.items || []).map((item) => (item.rowId === rowId ? { ...item, [field]: value } : item)),
    }));
  }

  function openProductPicker(rowId) {
    const row = (form.items || []).find((item) => item.rowId === rowId);
    setPickerState({
      rowId,
      query: text(row?.productName || row?.productSku || ""),
    });
  }

  function closeProductPicker() {
    setPickerState({ rowId: "", query: "" });
  }

  function toggleRow(rowId) {
    setExpandedRows((current) => ({ ...current, [rowId]: !current[rowId] }));
  }

  function removeItem(rowId) {
    setForm((current) => {
      const nextItems = (current.items || []).filter((item) => item.rowId !== rowId);
      return {
        ...current,
        items: nextItems.length ? nextItems : [emptyItem(current.docType)],
      };
    });
  }

  function duplicateItem(rowId) {
    setForm((current) => {
      const source = (current.items || []).find((item) => item.rowId === rowId);
      if (!source) return current;
      return {
        ...current,
        items: [...(current.items || []), { ...source, rowId: newRowId() }],
      };
    });
  }

  function addManualItem() {
    const nextItem = emptyItem(form.docType);
    setForm((current) => ({
      ...current,
      items: [...(current.items || []), nextItem],
    }));
  }

  function handleCariChange(value) {
    const selected = cariOptions.find((item) => item.value === value);
    setForm((current) => ({
      ...current,
      cariId: value,
      cariName: selected?.name || "",
    }));
  }

  function addSelectedProduct() {
    const product = productOptions.find((item) => item.id === selectedProductId);
    if (!product) return;

    const productSeed = createSeedFromProduct(product);
    setForm((current) => {
      const currentItems = [...(current.items || [])];
      const mergeKey = mergeableKey(productSeed);
      const existingIndex = currentItems.findIndex((item) => mergeableKey(item) === mergeKey);

      if (!separateLineMode && existingIndex >= 0) {
        currentItems[existingIndex] = {
          ...currentItems[existingIndex],
          quantity: round2(num(currentItems[existingIndex].quantity, 0) + 1),
        };
        setNotice(`${product.name} mevcut satira eklendi (+1).`);
        return { ...current, items: currentItems };
      }

      setNotice(`${product.name} yeni satir olarak eklendi.`);
      return { ...current, items: [...currentItems, productSeed] };
    });

    setSelectedProductId("");
    setProductQuery("");
  }

  function assignProductToRow(rowId, product) {
    if (!rowId || !product) return;
    const productSeed = createSeedFromProduct(product);
    setForm((current) => ({
      ...current,
      items: (current.items || []).map((item) =>
        item.rowId === rowId
          ? {
              ...item,
              productId: productSeed.productId,
              productSku: productSeed.productSku,
              productName: productSeed.productName,
              unit: productSeed.unit,
              unitPrice: productSeed.unitPrice,
              stockTracked: productSeed.stockTracked,
              webPublished: productSeed.webPublished,
            }
          : item
      ),
    }));
    closeProductPicker();
  }

  async function handleSaveDraft() {
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const result = await saveErpDraftDocument({
        kind,
        payload: { ...form, id: form.id, items: costedItems, totalAmount: documentTotal },
        settings,
      });
      setNotice(`Taslak kaydedildi: ${result.draftNo}`);
      router.push(`/satissitok/admin/erp/${kind}`);
    } catch (err) {
      setError(err?.message || "Taslak kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const result = await confirmErpDocument({
        kind,
        payload: { ...form, id: form.id, items: costedItems, totalAmount: documentTotal },
        settings,
      });
      setNotice(`Belge onaylandi: ${result.documentNo}`);
      router.push(`/satissitok/admin/erp/${kind}`);
    } catch (err) {
      setError(err?.message || "Belge onaylanamadi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <CardShell text="Belge editoru hazirlaniyor..." />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
          ERP / {isSales ? "Satislar" : "Satinalmalar"}
        </div>
        <h2 className="text-3xl font-black tracking-[-0.03em] text-[#1d3246]">{title}</h2>
        <p className="max-w-4xl text-sm leading-6 text-slate-600">
          Belge bilgileri ustte, urun calisma alani tam genislikte ve tum toplamlar altta toplandi.
          Son fiyat hafizasi, manuel maliyet ve canli kar gorunumu bu ekranda ayni anda kullanilabilir.
        </p>
        {isEditMode ? (
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Duzenlenen belge durumu: {loadedStatus || "yukleniyor"}
          </div>
        ) : null}
      </div>

      {notice ? <Banner tone="green" text={notice} /> : null}
      {isSales && isEditMode ? <div className="flex flex-wrap items-center gap-3"><ErpSalesPdfButton documentId={documentId} /><span className="text-xs text-slate-500">PDF son kaydedilen belgeyi içerir.</span></div> : null}
      {error ? <Banner tone="red" text={error} /> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Belge Tipi"
            value={form.docType}
            onChange={(value) => setField("docType", value)}
            options={[
              { value: "R", label: "R Belge" },
              { value: "F", label: "F Belge" },
            ]}
          />
          <InputField
            label="Belge Tarihi"
            type="date"
            value={form.documentDate}
            onChange={(value) => setField("documentDate", value)}
          />
          <SelectField
            label="Cari Secimi"
            value={form.cariId}
            onChange={handleCariChange}
            options={cariOptions.map((item) => ({
              value: item.value,
              label: item.isActive ? item.label : `${item.label} (pasif)`,
            }))}
          />
          <InputField
            label="Cari Adi"
            value={form.cariName}
            onChange={(value) => setField("cariName", value)}
            placeholder={isSales ? "Musteri adini yaz" : "Tedarikci adini yaz"}
          />

          <SelectField
            label="Depo"
            value={form.warehouseKey}
            onChange={(value) => setField("warehouseKey", value)}
            options={warehouseOptions.map((item) => ({ value: item.key, label: item.label }))}
          />
          {isSales ? (
            <SelectField
              label="Satis Platformu"
              value={form.platformKey}
              onChange={(value) => setField("platformKey", value)}
              options={platformOptions.map((item) => ({ value: item.key, label: item.label }))}
            />
          ) : (
            <InfoTile
              label="Stok Etkisi"
              value={`${form.docType} stok havuzu`}
              hint={form.docType === "F" ? "Yalniz F stok artar" : "Yalniz R stok artar"}
            />
          )}

          <InputField
            label="Belge No"
            value={form.documentNo}
            onChange={(value) => setField("documentNo", value)}
            placeholder={previews.document || "Otomatik olusacak"}
          />
          <InputField
            label="Fatura No"
            value={form.invoiceNo}
            onChange={(value) => setField("invoiceNo", value)}
            placeholder={previews.invoice || "Otomatik olusacak"}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/satissitok/admin/erp/caris/new?returnTo=/satissitok/admin/erp/${kind}/new`}
            className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Listede yoksa yeni cari olustur
          </Link>
          <Tag tone="slate" label={`Taslak No: ${previews.draft || "-"}`} />
          <Tag tone="blue" label={`Belge No: ${form.documentNo || previews.document || "-"}`} />
          <Tag tone="amber" label={`Fatura No: ${form.invoiceNo || previews.invoice || "-"}`} />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="text-xl font-black tracking-[-0.03em] text-[#1d3246]">Urun Kalemleri</div>
            <div className="text-sm text-slate-600">
              Ana akis satir bazli calisir. Satir ekleyip urunu satirin icinden sec, detaylari ihtiyac oldugunda ac.
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={separateLineMode}
                onChange={(event) => setSeparateLineMode(event.target.checked)}
              />
              Hizli eklemede ayri satir kullan
            </label>
            <button
              type="button"
              onClick={addManualItem}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <PlusCircle size={14} />
              Satir Ekle
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            <Search size={14} />
            Hizli Ekle
          </div>
          <div className="grid gap-3 xl:grid-cols-[1.15fr_1fr_auto]">
            <InputShell
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Turkce, Rusca, SKU, barkod veya marka ara"
            />
            <SelectShell value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
              <option value="">Urun sec</option>
              {filteredProducts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.nameRu ? ` / ${item.nameRu}` : ""} {item.sku ? `(${item.sku})` : ""}
                </option>
              ))}
            </SelectShell>
            <button
              type="button"
              onClick={addSelectedProduct}
              disabled={!selectedProductId}
              className="rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Urun Ekle
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div>{filteredProducts.length} urun listeleniyor</div>
            {selectedProduct ? (
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
                Secili: {selectedProduct.name} {selectedProduct.sku ? ` - ${selectedProduct.sku}` : ""}
              </div>
            ) : (
              <div>Bu alan opsiyonel hizli ekleme icin duruyor; ana kullanim satir icinden urun secmek.</div>
            )}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-3 font-semibold min-w-[360px]">Urun</th>
                <th className="px-3 py-3 font-semibold min-w-[110px]">Miktar</th>
                <th className="px-3 py-3 font-semibold min-w-[100px]">Birim</th>
                <th className="px-3 py-3 font-semibold min-w-[140px]">{isSales ? "Satis Fiyati" : "Alis Fiyati"}</th>
                <th className="px-3 py-3 font-semibold min-w-[130px]">Tutar</th>
                <th className="px-3 py-3 font-semibold min-w-[140px]">{isSales ? "Stok Kaynagi" : "Efektif Maliyet"}</th>
                <th className="px-3 py-3 font-semibold min-w-[160px]">{isSales ? "Satir Kar" : "Son Fiyat"}</th>
                <th className="px-3 py-3 font-semibold min-w-[220px]">Islem</th>
              </tr>
            </thead>
            <tbody>
              {costedItems.length ? (
                costedItems.map((item) => {
                const rowExpanded = expandedRows[item.rowId] === true;
                const purchaseHintPrimary =
                  item.purchaseHints.lastPurchaseByCari ||
                  item.purchaseHints.lastPurchase ||
                  item.purchaseHints.lastPurchaseByDocType ||
                  null;

                return (
                  <Fragment key={item.rowId}>
                    <tr className="border-b border-slate-100 align-top bg-white">
                      <td className="px-3 py-3">
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => toggleRow(item.rowId)}
                              className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
                              aria-label={rowExpanded ? "Satiri kapat" : "Satiri ac"}
                            >
                              {rowExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => openProductPicker(item.rowId)}
                              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-800 transition hover:border-slate-300 hover:bg-white"
                            >
                              <div className="font-semibold">{item.productName || "Urun secmek icin tikla"}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.productId
                                  ? `${item.productSku || "-"} - ${item.unit || "adet"}`
                                  : "Rusca/Turkce arama, SKU ve barkod ile secim yapabilirsin"}
                              </div>
                            </button>
                          </div>
                          {!item.productId ? (
                            <input
                              value={item.productName}
                              onChange={(event) => updateItem(item.rowId, "productName", event.target.value)}
                              className={inputClassName("w-full")}
                              placeholder="Manuel satirsa urun adini yaz"
                            />
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {item.webPublished ? <Tag tone="blue" label="Webde yayinda" /> : <Tag tone="slate" label="Web disi" />}
                            {item.stockTracked === false ? <Tag tone="amber" label="Stok takipsiz" /> : null}
                            {item.productId ? <Tag tone="green" label="Listeden secildi" /> : <Tag tone="amber" label="Manuel satir" />}
                            {isSales && item.manualUnitCost ? <Tag tone="amber" label="Manuel maliyet" /> : null}
                            {isSales && item.usedFallback ? <Tag tone="red" label="Fallback" /> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.rowId, "quantity", event.target.value)}
                          className={inputClassName("w-[96px]")}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={item.unit}
                          onChange={(event) => updateItem(item.rowId, "unit", event.target.value)}
                          className={inputClassName("w-[90px]")}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(event) => updateItem(item.rowId, "unitPrice", event.target.value)}
                          className={inputClassName("w-[120px]")}
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{fmtMoney(item.lineTotal)} KZT</td>
                      <td className="px-3 py-3">
                        {isSales ? (
                          <select
                            value={item.stockSourceType || form.docType}
                            onChange={(event) => updateItem(item.rowId, "stockSourceType", event.target.value)}
                            className={selectClassName("min-w-[110px]")}
                          >
                            <option value="R">R stok</option>
                            <option value="F">F stok</option>
                          </select>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900">{fmtMoney(item.effectiveUnitCost)} KZT</div>
                            <div className="text-xs text-slate-500">{form.docType} havuzu</div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isSales ? (
                          <div className={`font-semibold ${item.netProfitLine >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {fmtMoney(item.netProfitLine)} KZT
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900">
                              {purchaseHintPrimary ? `${fmtMoney(purchaseHintPrimary.value)} KZT` : "-"}
                            </div>
                            <div className="text-xs text-slate-500">{purchaseHintPrimary?.label || "Son fiyat yok"}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => duplicateItem(item.rowId)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                          >
                            <CopyPlus size={14} />
                            Cogalt
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.rowId)}
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                          >
                            <Trash2 size={14} />
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                    {rowExpanded ? (
                      <tr className="border-b border-slate-200 bg-[#eef4ff]">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid gap-4 xl:grid-cols-3">
                            <DetailBox title={isSales ? "Fiyat Hafizasi" : "Son Alis Hafizasi"}>
                              {isSales ? (
                                <>
                                  <InfoRow label="Product varsayilan fiyat" value={`${fmtMoney(item.unitPrice)} KZT`} />
                                  <InfoRow label="Son satis" value={priceText(item.salesHints.lastSale)} />
                                  <InfoRow label="Bu cariye son satis" value={priceText(item.salesHints.lastSaleByCari)} />
                                  <InfoRow label="Bu evrak turunde son satis" value={priceText(item.salesHints.lastSaleByDocType)} />
                                </>
                              ) : (
                                <>
                                  <InfoRow label="Son alis" value={priceText(item.purchaseHints.lastPurchase)} />
                                  <InfoRow label="Bu cariden son alis" value={priceText(item.purchaseHints.lastPurchaseByCari)} />
                                  <InfoRow label="Bu evrak turunde son alis" value={priceText(item.purchaseHints.lastPurchaseByDocType)} />
                                </>
                              )}
                            </DetailBox>

                            <DetailBox title={isSales ? "Maliyet Bilgisi" : "Maliyet Dagilimi"}>
                              {isSales ? (
                                <>
                                  <InfoRow label="Sistem maliyeti" value={`${fmtMoney(item.systemCostUnit)} KZT`} />
                                  <InputField
                                    label="Manuel maliyet"
                                    type="number"
                                    value={item.manualUnitCost}
                                    onChange={(value) => updateItem(item.rowId, "manualUnitCost", value)}
                                    placeholder="Yoksa bos birak"
                                    compact
                                  />
                                  <InfoRow label="Kullanilan maliyet" value={`${fmtMoney(item.baseCostUnit)} KZT`} />
                                  <InfoRow
                                    label="Maliyet kaynagi"
                                    value={
                                      item.manualUnitCost
                                        ? "manuel"
                                        : item.usedFallback
                                          ? `fallback (${item.stockCostSource})`
                                          : `${item.stockCostSource} stok`
                                    }
                                  />
                                </>
                              ) : (
                                <>
                                  <InfoRow label="Ham alis fiyat" value={`${fmtMoney(item.unitPrice)} KZT`} />
                                  <InfoRow label="Ek masraf payi" value={`${fmtMoney(item.allocatedAdditionalCost)} KZT`} />
                                  <InfoRow label="Efektif birim maliyet" value={`${fmtMoney(item.effectiveUnitCost)} KZT`} />
                                  <InfoRow label="Efektif satir maliyeti" value={`${fmtMoney(item.effectiveLineCost)} KZT`} />
                                </>
                              )}
                            </DetailBox>

                            <DetailBox title={isSales ? "Uyari ve Not" : "Stok Etkisi ve Not"}>
                              {isSales ? (
                                <>
                                  <InfoRow label="Brut kar" value={`${fmtMoney(item.grossProfitLine)} KZT`} />
                                  <InfoRow label="Net kar" value={`${fmtMoney(item.netProfitLine)} KZT`} />
                                  <InfoRow
                                    label="Stok durumu"
                                    value={item.balance ? `${fmtQty(item.balance.totalQty)} adet` : "Kayit yok"}
                                  />
                                  <InfoRow label="Negatif stok riski" value={item.balance && item.balance.totalQty - item.quantity < 0 ? "evet" : "hayir"} />
                                </>
                              ) : (
                                <>
                                  <InfoRow label="Stoga girecek havuz" value={`${form.docType} stok`} />
                                  <InfoRow label="R stoga etki" value={form.docType === "R" ? `${fmtQty(item.quantity)} adet` : "-"} />
                                  <InfoRow label="F stoga etki" value={form.docType === "F" ? `${fmtQty(item.quantity)} adet` : "-"} />
                                  <InfoRow label="Satir tutar" value={`${fmtMoney(item.lineTotal)} KZT`} />
                                </>
                              )}
                              <TextAreaField
                                label="Satir Notu"
                                value={item.notes || ""}
                                onChange={(value) => updateItem(item.rowId, "notes", value)}
                                compact
                              />
                            </DetailBox>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
              ) : (
                <tr className="bg-white">
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    Henuz urun eklenmedi. Satir ekleyip urunu satirin icinden sec veya ustteki hizli ekleyi kullan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-[-0.03em] text-[#1d3246]">
              {isSales ? "Kar ve Maliyet Ozeti" : "Maliyet Ozeti"}
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              Belgenin toplamlari ve maliyet etkisi burada canli hesaplanir.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MiniMetric label="Ara Toplam" value={`${fmtMoney(goodsTotal)} KZT`} tone="slate" />
            <MiniMetric label="Ek Masraf" value={`${fmtMoney(additionalCostTotal)} KZT`} tone="amber" />
            <MiniMetric label="Belge Toplami" value={`${fmtMoney(documentTotal)} KZT`} tone="blue" />
            <MiniMetric label="Toplam Maliyet" value={`${fmtMoney(totalCost)} KZT`} tone="red" />
            {isSales ? (
              <>
                <MiniMetric label="Brut Kar" value={`${fmtMoney(grossProfit)} KZT`} tone="green" />
                <MiniMetric label="Net Kar" value={`${fmtMoney(netProfit)} KZT`} tone={netProfit >= 0 ? "green" : "red"} />
                <MiniMetric label="Kar Marji" value={fmtPercent(marginRate)} tone="slate" />
              </>
            ) : (
              <>
                <MiniMetric label="Masraf Yuku" value={goodsTotal > 0 ? fmtPercent((additionalCostTotal / goodsTotal) * 100) : "0.00%"} tone="green" />
                <MiniMetric label="R Stoga Giris" value={form.docType === "R" ? `${fmtMoney(costedItems.reduce((sum, item) => sum + item.quantity, 0))} adet` : "-"} tone="blue" />
                <MiniMetric label="F Stoga Giris" value={form.docType === "F" ? `${fmtMoney(costedItems.reduce((sum, item) => sum + item.quantity, 0))} adet` : "-"} tone="amber" />
              </>
            )}
          </div>

          <InputField
            label={additionalCostLabel}
            type="number"
            value={form.additionalCostTotal}
            onChange={(value) => setField("additionalCostTotal", value)}
            placeholder="0"
          />

          <TextAreaField
            label="Belge Notlari"
            value={form.notes}
            onChange={(value) => setField("notes", value)}
          />
        </div>

        <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-[-0.03em] text-[#1d3246]">{actionLabel} ve Belge Ozeti</h3>
            <p className="text-sm leading-6 text-slate-600">
              Belgeyi kaydederken aninda {actionLabel.toLowerCase()} islemek istersen finans alani buradan yonetilir.
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.instantPaymentEnabled === true}
              onChange={(event) => {
                const enabled = event.target.checked;
                setForm((current) => ({
                  ...current,
                  instantPaymentEnabled: enabled,
                  paidAmount:
                    enabled && num(current.paidAmount, 0) <= 0
                      ? String(documentTotal)
                      : current.paidAmount,
                }));
              }}
            />
            Bu belge ile birlikte aninda {actionLabel.toLowerCase()} isle
          </label>

          {form.instantPaymentEnabled ? (
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label={`${actionLabel} Tutari`}
                type="number"
                value={form.paidAmount}
                onChange={(value) => setField("paidAmount", value)}
                placeholder="0"
              />
              <InputField
                label={`${actionLabel} Tarihi`}
                type="date"
                value={form.paidDate}
                onChange={(value) => setField("paidDate", value)}
              />
              <ErpCashAccountSelect value={form.accountId} onChange={(value) => setField("accountId", value)} options={accountOptions} onRefresh={setAccountOptions} />
              <SelectField
                label="Odeme Yontemi"
                value={form.paymentMethod}
                onChange={(value) => setField("paymentMethod", value)}
                options={paymentMethods.map((item) => ({ value: item.key, label: item.label }))}
              />
            </div>
          ) : null}

          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <InfoRow label="Cari" value={form.cariName || "Secilmedi"} />
            <InfoRow label="Belge Toplami" value={`${fmtMoney(documentTotal)} KZT`} />
            <InfoRow label={`${actionLabel} Tutar`} value={`${fmtMoney(totalPaid)} KZT`} />
            <InfoRow label="Kalan" value={`${fmtMoney(remainingAmount)} KZT`} />
            <InfoRow label="Belge Durumu" value={saving ? "isleniyor" : "hazir"} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/satissitok/admin/erp/finance/accounts/new"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Hesap yoksa yeni finans hesabi olustur
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || loadedStatus === "confirmed"}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Taslak Kaydet"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || loadedStatus === "confirmed"}
              className="rounded-2xl bg-[#1d3246] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Belgeyi Onayla"}
            </button>
          </div>
          {loadedStatus === "confirmed" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Bu belge onayli. Cift stok ve finans etkisini onlemek icin bu fazda onayli belgeleri yeniden isleme kapali.
              Sonraki fazda kontrollu revizyon / ters kayit akisini ekleyebiliriz.
            </div>
          ) : null}
        </div>
      </section>

      <ProductPickerDialog
        open={Boolean(pickerState.rowId)}
        title={pickerRow?.productName || "Satir icin urun sec"}
        query={pickerState.query}
        products={pickerProducts}
        onClose={closeProductPicker}
        onQueryChange={(value) => setPickerState((current) => ({ ...current, query: value }))}
        onPick={(product) => assignProductToRow(pickerState.rowId, product)}
      />
    </div>
  );
}

function Banner({ tone, text }) {
  const className =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${className}`}>{text}</div>;
}

function CardShell({ text }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
      {text}
    </div>
  );
}

function ProductThumb({ product }) {
  const src = text(product?.imageUrl) || "/Placeholder.png";

  return (
    <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <Image src={src} alt={product?.name || "Urun"} fill unoptimized className="object-contain p-1" />
    </div>
  );
}

function ProductPickerDialog({ open, title, query, products, onClose, onQueryChange, onPick }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Urun Secimi</div>
            <div className="mt-1 text-lg font-black text-[#1d3246]">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <InputField
            label="Arama"
            value={query}
            onChange={onQueryChange}
            placeholder="Turkce, Rusca, SKU, barkod veya marka ara"
          />

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {products.length ? (
              products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onPick(product)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <ProductThumb product={product} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-slate-900">{product.name || "-"}</div>
                    {product.nameRu ? <div className="truncate text-xs text-slate-500">{product.nameRu}</div> : null}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{product.sku || "-"}</span>
                      <span>{product.brand || "-"}</span>
                      <span>{product.unit || "adet"}</span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Sonuc bulunamadi.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function inputClassName(extra = "") {
  return `rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white ${extra}`.trim();
}

function selectClassName(extra = "") {
  return `rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white ${extra}`.trim();
}

function InputShell({ value, onChange, placeholder = "" }) {
  return <input value={value} onChange={onChange} placeholder={placeholder} className={inputClassName("w-full px-4 py-3 rounded-2xl")} />;
}

function SelectShell({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange} className={selectClassName("w-full px-4 py-3 rounded-2xl")}>
      {children}
    </select>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder = "", compact = false }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${inputClassName("w-full rounded-2xl")} ${compact ? "px-3 py-2" : "px-4 py-3"}`}
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange, compact = false }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={compact ? 3 : 5}
        className={`w-full rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white ${compact ? "px-3 py-2" : "px-4 py-3"}`}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName("w-full rounded-2xl px-4 py-3")}
      >
        <option value="">Sec</option>
        {(options || []).map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );
}

function DetailBox({ title, children }) {
  return (
    <div className="space-y-3 rounded-[22px] border border-slate-200 bg-white p-4">
      <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Tag({ label, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
  };

  return <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${toneMap[tone] || toneMap.slate}`}>{label}</span>;
}

function InfoTile({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function MiniMetric({ label, value, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-900",
    blue: "bg-blue-50 text-blue-900",
    amber: "bg-amber-50 text-amber-900",
    green: "bg-emerald-50 text-emerald-900",
    red: "bg-rose-50 text-rose-900",
  };

  return (
    <div className={`rounded-[20px] p-4 ${toneMap[tone] || toneMap.slate}`}>
      <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

function priceText(priceHint) {
  if (!priceHint) return "-";
  return `${fmtMoney(priceHint.value)} KZT`;
}
