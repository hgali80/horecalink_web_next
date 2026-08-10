"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/firebase";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileDown, FilePlus2, Printer, Save } from "lucide-react";

import { useLang } from "@/app/context/LanguageContext";

const LOCALE_MAP = {
  tr: "tr-TR",
  ru: "ru-RU",
  kz: "kk-KZ",
  en: "en-US",
};

function formatDate(value, lang = "tr") {
  if (!value) return "-";
  const locale = LOCALE_MAP[lang] || LOCALE_MAP.tr;

  try {
    if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString(locale);
    return new Date(value).toLocaleString(locale);
  } catch {
    return "-";
  }
}

function formatMoney(value, lang = "tr") {
  const locale = LOCALE_MAP[lang] || LOCALE_MAP.tr;
  return `${Number(value || 0).toLocaleString(locale)} KZT`;
}

function getCustomerName(customer) {
  return customer?.name || customer?.fullName || "-";
}

function getCompanyName(customer) {
  return customer?.company || customer?.companyName || "-";
}

function getItemName(item) {
  return item?.requestedProduct?.name || item?.fulfilledProduct?.name || item?.name || "-";
}

function getItemSku(item) {
  return item?.sku || item?.productId || item?.requestedProduct?.productId || "-";
}

function getInitialQty(item) {
  return Number(item?.qtyOffered ?? item?.qtyRequested ?? item?.quantity ?? 0);
}

function getInitialListPrice(item) {
  return Number(item?.listPrice ?? item?.pricing?.listUnitPrice ?? item?.price ?? 0);
}

function getInitialSpecialPrice(item) {
  const value =
    item?.specialPrice ?? item?.requestedPrice ?? item?.pricing?.offeredUnitPrice;
  return value == null ? "" : Number(value);
}

function getInitialDiscountPercent(item) {
  const value = item?.discountPercent ?? item?.pricing?.discountPercent;
  return value == null ? "" : Number(value);
}

function normalizeNumberInput(value) {
  if (value === "" || value == null) return "";
  const n = Number(String(value).replace(",", "."));
  return Number.isNaN(n) ? "" : n;
}

function buildStatusOptions(t) {
  return [
    { key: "new", label: t("adminQuoteDetail.status.new") },
    { key: "received", label: t("adminQuoteDetail.status.received") },
    { key: "reviewing", label: t("adminQuoteDetail.status.reviewing") },
    { key: "preparing", label: t("adminQuoteDetail.status.preparing") },
    { key: "offered", label: t("adminQuoteDetail.status.offered") },
    { key: "in_delivery", label: t("adminQuoteDetail.status.inDelivery") },
    { key: "completed", label: t("adminQuoteDetail.status.completed") },
    { key: "cancelled", label: t("adminQuoteDetail.status.cancelled") },
  ];
}

function resolveDocumentNumber(data, requestId) {
  return data?.quoteNo || data?.requestNo || data?.quoteId || requestId || "-";
}

export default function RequestDetailPage() {
  const { requestId } = useParams();
  const router = useRouter();
  const { lang, t } = useLang();

  const [data, setData] = useState(null);
  const [editableItems, setEditableItems] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);

  useEffect(() => {
    async function load() {
      try {
        const ref = doc(db, "quote_requests", requestId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setData(null);
          return;
        }

        const row = { id: snap.id, ...snap.data() };
        const items = Array.isArray(row.items) ? row.items : [];

        setData(row);
        setEditableItems(
          items.map((item, index) => ({
            ...item,
            __rowId: item?.lineId || item?.productId || `row_${index}`,
            quantity: getInitialQty(item),
            listPrice: getInitialListPrice(item),
            discountPercent:
              getInitialDiscountPercent(item) == null ? "" : getInitialDiscountPercent(item),
            specialPrice:
              getInitialSpecialPrice(item) == null ? "" : getInitialSpecialPrice(item),
          }))
        );
        setInternalNote(row?.notes?.internalNote || "");
        setCustomerNote(row?.notes?.customerNote || "");
      } catch (error) {
        console.error("Quote detail could not be loaded:", error);
      } finally {
        setLoading(false);
      }
    }

    if (requestId) load();
  }, [requestId]);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoadingProducts(true);
        const snapshot = await getDocs(
          query(
            collection(db, "products"),
            where("active", "==", true)
          )
        );

        const rows = snapshot.docs.map((docItem) => {
          const product = docItem.data() || {};
          return {
            id: docItem.id,
            name:
              product.name ||
              product.name_ru ||
              product.name_tr ||
              product.title ||
              docItem.id,
            sku:
              product.sku ||
              product.stock_code ||
              product.manufacturerCode ||
              docItem.id,
            brand: product.brand || "",
            price: Number(product.price || 0),
            slug: product.slug || "",
          };
        });

        rows.sort((a, b) => String(a.name).localeCompare(String(b.name), LOCALE_MAP[lang] || "ru-RU"));
        setCatalogProducts(rows);
      } catch (error) {
        console.error("Products could not be loaded:", error);
      } finally {
        setLoadingProducts(false);
      }
    }

    loadProducts();
  }, [lang]);

  useEffect(() => {
    if (!data) return;
    const previousTitle = document.title;
    document.title = `HorecaLink - ${resolveDocumentNumber(data, requestId)}`;
    return () => {
      document.title = previousTitle;
    };
  }, [data, requestId]);

  async function updateStatus(status) {
    try {
      setSavingStatus(true);
      await updateDoc(doc(db, "quote_requests", requestId), {
        status,
        updatedAt: serverTimestamp(),
      });
      setData((prev) => ({ ...prev, status }));
    } catch (error) {
      console.error("Status could not be updated:", error);
      alert(t("adminQuoteDetail.alerts.statusUpdateError"));
    } finally {
      setSavingStatus(false);
    }
  }

  function updateItemValue(rowId, field, value) {
    setEditableItems((prev) =>
      prev.map((item) => {
        if (item.__rowId !== rowId) return item;

        if (field === "specialPrice") {
          return {
            ...item,
            specialPrice: value,
            discountPercent: value === "" ? item.discountPercent : "",
          };
        }

        if (field === "discountPercent") {
          return {
            ...item,
            discountPercent: value,
            specialPrice: value === "" ? item.specialPrice : "",
          };
        }

        return { ...item, [field]: value };
      })
    );
  }

  function removeItem(rowId) {
    setEditableItems((prev) => prev.filter((item) => item.__rowId !== rowId));
  }

  function addProductToQuote() {
    if (!selectedProductId) return;

    const selected = catalogProducts.find((item) => item.id === selectedProductId);
    if (!selected) return;

    setEditableItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === selected.id || item.__rowId === selected.id
      );

      if (existing) {
        return prev.map((item) =>
          item.__rowId === existing.__rowId
            ? { ...item, quantity: Number(item.quantity || 0) + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          __rowId: selected.id,
          productId: selected.id,
          sku: selected.sku,
          brand: selected.brand,
          slug: selected.slug,
          name: selected.name,
          quantity: 1,
          listPrice: selected.price,
          specialPrice: "",
          discountPercent: "",
          requestedProduct: {
            name: selected.name,
            productId: selected.id,
          },
        },
      ];
    });

    setSelectedProductId("");
    setProductQuery("");
  }

  const calculatedItems = useMemo(
    () =>
      editableItems.map((item) => {
        const quantity = Number(item.quantity || 0);
        const listPrice = Number(item.listPrice || 0);
        const discountPercent =
          item.discountPercent === "" ? null : Number(item.discountPercent || 0);
        const specialPrice =
          item.specialPrice === "" ? null : Number(item.specialPrice || 0);
        const discountedPrice =
          discountPercent != null
            ? Math.max(0, listPrice - (listPrice * discountPercent) / 100)
            : null;
        const effectiveUnitPrice =
          specialPrice != null ? specialPrice : discountedPrice != null ? discountedPrice : listPrice;
        return {
          ...item,
          quantity,
          listPrice,
          discountPercent,
          specialPrice,
          effectiveUnitPrice,
          lineListTotal: quantity * listPrice,
          lineSpecialTotal: quantity * effectiveUnitPrice,
        };
      }),
    [editableItems]
  );

  const totals = useMemo(() => {
    const listAmount = calculatedItems.reduce((sum, item) => sum + item.lineListTotal, 0);
    const finalAmount = calculatedItems.reduce((sum, item) => sum + item.lineSpecialTotal, 0);
    return {
      listAmount,
      finalAmount,
      totalQuantity: calculatedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      discountAmount: listAmount - finalAmount,
    };
  }, [calculatedItems]);

  async function handleSaveAll() {
    try {
      setSavingForm(true);
      const nextItems = calculatedItems.map((item) => {
        const baseItem = { ...item };
        delete baseItem.__rowId;
        const {
          quantity,
          listPrice,
          discountPercent,
          specialPrice,
          effectiveUnitPrice,
          lineListTotal,
          lineSpecialTotal,
          ...rest
        } = baseItem;

        return {
          ...rest,
          quantity,
          qtyOffered: quantity,
          listPrice,
          price: listPrice,
          discountPercent: discountPercent == null ? null : discountPercent,
          specialPrice: specialPrice == null ? null : specialPrice,
          requestedPrice: specialPrice == null ? null : specialPrice,
          lineSpecialTotal,
          lineTotal: lineSpecialTotal,
          pricing: {
            listUnitPrice: listPrice,
            offeredUnitPrice: effectiveUnitPrice,
            discountPercent: discountPercent == null ? 0 : discountPercent,
            lineListTotal,
            lineFinalTotal: lineSpecialTotal,
          },
        };
      });

      await updateDoc(doc(db, "quote_requests", requestId), {
        items: nextItems,
        notes: { internalNote, customerNote },
        pricing: {
          listAmount: totals.listAmount,
          finalAmount: totals.finalAmount,
          discountAmount: totals.discountAmount,
          globalDiscountType: "none",
          globalDiscountValue: 0,
          globalDiscountAmount: totals.discountAmount,
        },
        updatedAt: serverTimestamp(),
      });

      setData((prev) => ({
        ...prev,
        items: nextItems,
        notes: { internalNote, customerNote },
      }));

      alert(t("adminQuoteDetail.alerts.saveSuccess"));
    } catch (error) {
      console.error("Quote could not be saved:", error);
      alert(t("adminQuoteDetail.alerts.saveError"));
    } finally {
      setSavingForm(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleSavePdf() {
    window.print();
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">{t("quoteRequest.loading")}</div>;
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          {t("quoteDetail.notFound")}
        </div>
      </div>
    );
  }

  const customer = data.customer || {};
  const activeStatus = data.status || "new";
  const currentStatusLabel =
    statusOptions.find((option) => option.key === activeStatus)?.label || activeStatus;
  const documentNumber = resolveDocumentNumber(data, requestId);
  const createdAt = formatDate(data.createdAt || data.requestMeta?.submittedAt, lang);
  const deliveryAddress = customer?.address || data?.requestMeta?.deliveryAddress || "-";
  const customerMessage = data?.requestMeta?.customerMessage || "";
  const filteredCatalogProducts = catalogProducts
    .filter((item) => {
      const q = productQuery.trim().toLowerCase();
      if (!q) return true;
      return [item.name, item.sku, item.brand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    })
    .slice(0, 50);

  return (
    <>
      <style jsx global>{`
        .print-document {
          display: none;
        }

        @media print {
          body {
            background: #ffffff !important;
          }

          .screen-view {
            display: none !important;
          }

          .print-document {
            display: block !important;
          }

          .print-product-name {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        }
      `}</style>

      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="screen-view space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold text-slate-900">{t("adminQuoteDetail.title")}</h1>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/satissitok/admin/quotes")}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                {t("adminQuoteDetail.back")}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <Printer size={16} />
                {t("quoteDetail.print")}
              </button>
              <button
                type="button"
                onClick={handleSavePdf}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                <FileDown size={16} />
                {t("adminQuoteDetail.savePdf")}
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    data.commercialOfferId
                      ? `/satissitok/admin/commercial-offers/${data.commercialOfferId}`
                      : `/satissitok/admin/commercial-offers/new?sourceRequestId=${encodeURIComponent(requestId)}`
                  )
                }
                className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
              >
                <FilePlus2 size={16} />
                {data.commercialOfferId
                  ? t("adminQuoteDetail.openCommercialOffer")
                  : t("adminQuoteDetail.createCommercialOffer")}
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={savingForm}
                className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Save size={16} />
                {savingForm ? t("adminQuoteDetail.saving") : t("adminQuoteDetail.save")}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-sm text-slate-500">{t("adminQuoteDetail.authorizedPerson")}</div>
                <div className="text-base font-semibold text-slate-900">{getCustomerName(customer)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">{t("adminQuoteDetail.company")}</div>
                <div className="text-base font-semibold text-slate-900">{getCompanyName(customer)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">{t("adminQuoteDetail.phone")}</div>
                <div className="text-base font-semibold text-slate-900">{customer?.phone || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">{t("adminQuoteDetail.email")}</div>
                <div className="text-base font-semibold text-slate-900">{customer?.email || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">{t("adminQuoteDetail.requestDate")}</div>
                <div className="text-base font-semibold text-slate-900">{createdAt}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">{t("adminQuoteDetail.currentStatus")}</div>
                <div className="text-base font-semibold text-slate-900">{currentStatusLabel}</div>
              </div>
            </div>
            {customerMessage ? (
              <div className="mt-5">
                <div className="text-sm text-slate-500">{t("adminQuoteDetail.customerMessage")}</div>
                <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{customerMessage}</div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-lg font-semibold text-slate-900">{t("adminQuoteDetail.status")}</div>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => {
                const active = activeStatus === status.key;
                return (
                  <button
                    key={status.key}
                    type="button"
                    disabled={savingStatus}
                    onClick={() => updateStatus(status.key)}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                      active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    } ${savingStatus ? "cursor-not-allowed opacity-70" : ""}`}
                  >
                    {status.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-slate-900">{t("adminQuoteDetail.productLines")}</div>
              <div className="text-sm text-slate-500">{t("adminQuoteDetail.totalLines")}: {calculatedItems.length}</div>
            </div>
            <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_1fr_auto]">
              <input
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder={t("adminQuoteDetail.addProductSearchPlaceholder")}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">{loadingProducts ? t("adminQuoteDetail.loadingProducts") : t("adminQuoteDetail.selectProduct")}</option>
                {filteredCatalogProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.sku ? `(${product.sku})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addProductToQuote}
                disabled={!selectedProductId}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("adminQuoteDetail.addProduct")}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("quoteDetail.table.product")}</th>
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("adminQuoteDetail.table.sku")}</th>
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("adminQuoteDetail.table.brand")}</th>
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("quoteDetail.table.quantity")}</th>
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("quoteDetail.table.listPrice")}</th>
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("adminQuoteDetail.discountPercent")}</th>
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("adminQuoteDetail.table.specialPrice")}</th>
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("quoteDetail.table.total")}</th>
                    <th className="px-3 py-3 font-semibold text-slate-700">{t("quoteRequest.table.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedItems.map((item) => (
                    <tr key={item.__rowId} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 text-slate-800">
                        <div className="font-medium">{getItemName(item)}</div>
                        {item?.slug ? <div className="mt-1 text-xs text-slate-400">{item.slug}</div> : null}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{getItemSku(item)}</td>
                      <td className="px-3 py-3 text-slate-600">{item?.brand || "-"}</td>
                      <td className="px-3 py-3"><input type="number" min="0" value={item.quantity ?? ""} onChange={(e) => updateItemValue(item.__rowId, "quantity", normalizeNumberInput(e.target.value))} className="w-24 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" /></td>
                      <td className="px-3 py-3"><input type="number" min="0" value={item.listPrice ?? ""} onChange={(e) => updateItemValue(item.__rowId, "listPrice", normalizeNumberInput(e.target.value))} className="w-32 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" /></td>
                      <td className="px-3 py-3"><input type="number" min="0" max="100" value={item.discountPercent ?? ""} placeholder="%" onChange={(e) => updateItemValue(item.__rowId, "discountPercent", normalizeNumberInput(e.target.value))} className="w-24 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" /></td>
                      <td className="px-3 py-3"><input type="number" min="0" value={item.specialPrice ?? ""} placeholder={t("adminQuoteDetail.specialPricePlaceholder")} onChange={(e) => updateItemValue(item.__rowId, "specialPrice", normalizeNumberInput(e.target.value))} className="w-32 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" /></td>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        <div>{formatMoney(item.lineSpecialTotal, lang)}</div>
                        {item.discountPercent != null && item.discountPercent !== "" ? (
                          <div className="mt-1 text-xs text-slate-400">%{item.discountPercent}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3"><button type="button" onClick={() => removeItem(item.__rowId)} className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100">{t("adminQuoteDetail.remove")}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 text-lg font-semibold text-slate-900">{t("adminQuoteDetail.internalNote")}</div>
              <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={6} className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none focus:border-blue-500" placeholder={t("adminQuoteDetail.internalNotePlaceholder")} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 text-lg font-semibold text-slate-900">{t("adminQuoteDetail.customerNote")}</div>
              <textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} rows={6} className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none focus:border-blue-500" placeholder={t("adminQuoteDetail.customerNotePlaceholder")} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">{t("adminQuoteDetail.totals")}</div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4"><div className="text-sm text-slate-500">{t("adminQuoteDetail.listTotal")}</div><div className="mt-1 text-xl font-bold text-slate-900">{formatMoney(totals.listAmount, lang)}</div></div>
              <div className="rounded-lg bg-slate-50 p-4"><div className="text-sm text-slate-500">{t("adminQuoteDetail.discountAmount")}</div><div className="mt-1 text-xl font-bold text-green-700">{formatMoney(totals.discountAmount, lang)}</div></div>
              <div className="rounded-lg bg-blue-50 p-4"><div className="text-sm text-slate-500">{t("adminQuoteDetail.finalTotal")}</div><div className="mt-1 text-2xl font-bold text-blue-800">{formatMoney(totals.finalAmount, lang)}</div></div>
            </div>
          </div>
        </div>

        <div className="print-document bg-white text-slate-900">
          <div className="mx-auto max-w-[1000px] space-y-5 text-[12px]">
            <div className="grid items-start gap-6 print:grid-cols-[1.15fr_0.85fr]">
              <div className="self-start text-[12px] leading-5">
                <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-slate-500">www.horecalink.kz</div>
                <div className="mb-2 font-semibold text-slate-900">{t("adminQuoteDetail.deliveryInfo")}</div>
                <div><span className="text-slate-500">{t("adminQuoteDetail.authorizedPerson")}:</span> <span className="font-semibold">{getCustomerName(customer)}</span></div>
                <div><span className="text-slate-500">{t("adminQuoteDetail.company")}:</span> <span className="font-semibold">{getCompanyName(customer)}</span></div>
                <div><span className="text-slate-500">{t("adminQuoteDetail.phone")}:</span> <span className="font-semibold">{customer?.phone || "-"}</span></div>
                <div><span className="text-slate-500">{t("adminQuoteDetail.email")}:</span> <span className="font-semibold">{customer?.email || "-"}</span></div>
                <div><span className="text-slate-500">{t("quoteRequest.addressLabel")}:</span> <span className="font-semibold">{deliveryAddress}</span></div>
              </div>

              <div className="self-start text-[12px] leading-5">
                <div className="mb-2 font-semibold text-slate-900">{t("adminQuoteDetail.customerMessage")}</div>
                <div className="mb-1"><span className="text-slate-500">{t("adminQuoteDetail.documentNo")}:</span> <span className="font-semibold">{documentNumber}</span></div>
                <div className="mb-2"><span className="text-slate-500">{t("adminQuoteDetail.requestDate")}:</span> <span className="font-semibold">{createdAt}</span></div>
                <div>{customerMessage || customerNote || t("adminQuoteDetail.customerMessageEmpty")}</div>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-300">
              <table className="min-w-full border-collapse text-[11px]">
                <colgroup>
                  <col style={{ width: "26px" }} />
                  <col />
                  <col style={{ width: "48px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "116px" }} />
                </colgroup>
                <thead>
                  <tr className="text-left">
                    <th className="px-2 py-3 font-bold text-slate-700">{t("adminQuoteDetail.table.lineShort")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("quoteDetail.table.product")}</th>
                    <th className="px-2 py-3 font-bold text-slate-700">{t("adminQuoteDetail.table.quantityShort")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("adminQuoteDetail.table.price")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("quoteDetail.table.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedItems.map((item, index) => (
                    <tr key={item.__rowId} className="border-t border-slate-200">
                      <td className="px-2 py-3">{index + 1}</td>
                      <td className="px-3 py-3 font-semibold">
                        <div className="print-product-name leading-4">{getItemName(item)}</div>
                      </td>
                      <td className="px-2 py-3">{item.quantity}</td>
                      <td className="px-3 py-3">{item.specialPrice == null || item.specialPrice === "" ? formatMoney(item.listPrice, lang) : formatMoney(item.specialPrice, lang)}</td>
                      <td className="px-3 py-3 font-bold">{formatMoney(item.lineSpecialTotal, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-md border border-slate-300 text-[12px]">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><span className="text-slate-500">{t("adminQuoteDetail.listTotal")}</span><span className="font-semibold">{formatMoney(totals.listAmount, lang)}</span></div>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><span className="text-slate-500">{t("adminQuoteDetail.discountAmount")}</span><span className="font-semibold">{formatMoney(totals.discountAmount, lang)}</span></div>
              <div className="flex items-center justify-between px-4 py-4 text-base"><span className="font-bold">{t("adminQuoteDetail.finalTotal")}</span><span className="text-lg font-bold">{formatMoney(totals.finalAmount, lang)}</span></div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-10">
              <div><div className="text-[11px] text-slate-500">{t("adminQuoteDetail.signatureSales")}</div><div className="mt-14 border-t border-slate-400 pt-2 text-[12px] text-slate-600">HorecaLink</div></div>
              <div><div className="text-[11px] text-slate-500">{t("adminQuoteDetail.signatureCustomer")}</div><div className="mt-14 border-t border-slate-400 pt-2 text-[12px] text-slate-600">{getCompanyName(customer)}</div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
