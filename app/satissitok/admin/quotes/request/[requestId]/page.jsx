//app/satissitok/admin/quotes/request/[requestId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

function formatDate(value) {
  if (!value) return "-";

  try {
    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleString("tr-TR");
    }

    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "-";
  }
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("tr-TR")} KZT`;
}

function getCustomerName(customer) {
  return customer?.name || customer?.fullName || "-";
}

function getCompanyName(customer) {
  return customer?.company || customer?.companyName || "-";
}

function getItemName(item) {
  return (
    item?.requestedProduct?.name ||
    item?.fulfilledProduct?.name ||
    item?.name ||
    "-"
  );
}

function getItemSku(item) {
  return item?.sku || item?.productId || item?.requestedProduct?.productId || "-";
}

function getInitialQty(item) {
  return Number(
    item?.qtyOffered ??
      item?.qtyRequested ??
      item?.quantity ??
      0
  );
}

function getInitialListPrice(item) {
  return Number(
    item?.listPrice ??
      item?.pricing?.listUnitPrice ??
      item?.price ??
      0
  );
}

function getInitialSpecialPrice(item) {
  const value =
    item?.specialPrice ??
    item?.requestedPrice ??
    item?.pricing?.offeredUnitPrice;

  return value == null ? "" : Number(value);
}

function normalizeNumberInput(value) {
  if (value === "" || value == null) return "";
  const n = Number(String(value).replace(",", "."));
  return Number.isNaN(n) ? "" : n;
}

const STATUS_OPTIONS = [
  { key: "new", label: "Yeni" },
  { key: "received", label: "Alındı" },
  { key: "reviewing", label: "İncelemede" },
  { key: "preparing", label: "Hazırlanıyor" },
  { key: "offered", label: "Teklif Hazır" },
  { key: "in_delivery", label: "Yolda" },
  { key: "completed", label: "Tamamlandı" },
  { key: "cancelled", label: "İptal" },
];

export default function RequestDetailPage() {
  const { requestId } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [editableItems, setEditableItems] = useState([]);
  const [internalNote, setInternalNote] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

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
        setData(row);

        const items = Array.isArray(row.items) ? row.items : [];

        setEditableItems(
          items.map((item, index) => ({
            ...item,
            __rowId: item?.lineId || item?.productId || `row_${index}`,
            quantity: getInitialQty(item),
            listPrice: getInitialListPrice(item),
            specialPrice:
  getInitialSpecialPrice(item) == null
    ? ""
    : getInitialSpecialPrice(item),
          }))
        );

        setInternalNote(row?.notes?.internalNote || "");
        setCustomerNote(row?.notes?.customerNote || "");
      } catch (error) {
        console.error("Teklif detayı yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    }

    if (requestId) load();
  }, [requestId]);

  async function updateStatus(status) {
    try {
      setSavingStatus(true);

      const ref = doc(db, "quote_requests", requestId);

      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
      });

      setData((prev) => ({
        ...prev,
        status,
      }));
    } catch (error) {
      console.error("Durum güncellenemedi:", error);
      alert("Durum güncellenemedi.");
    } finally {
      setSavingStatus(false);
    }
  }

  function updateItemValue(rowId, field, value) {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.__rowId === rowId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function removeItem(rowId) {
    setEditableItems((prev) => prev.filter((item) => item.__rowId !== rowId));
  }

  const calculatedItems = useMemo(() => {
    return editableItems.map((item) => {
      const quantity = Number(item.quantity || 0);
      const listPrice = Number(item.listPrice || 0);
      const specialPrice =
        item.specialPrice === "" ? null : Number(item.specialPrice || 0);

      const effectiveUnitPrice =
        specialPrice != null ? specialPrice : listPrice;

      const lineListTotal = quantity * listPrice;
      const lineSpecialTotal = quantity * effectiveUnitPrice;

      return {
        ...item,
        quantity,
        listPrice,
        specialPrice,
        effectiveUnitPrice,
        lineListTotal,
        lineSpecialTotal,
      };
    });
  }, [editableItems]);

  const totals = useMemo(() => {
    const listAmount = calculatedItems.reduce(
      (sum, item) => sum + item.lineListTotal,
      0
    );

    const finalAmount = calculatedItems.reduce(
      (sum, item) => sum + item.lineSpecialTotal,
      0
    );

    return {
      listAmount,
      finalAmount,
      discountAmount: listAmount - finalAmount,
    };
  }, [calculatedItems]);

  async function handleSaveAll() {
    try {
      setSavingForm(true);

      const ref = doc(db, "quote_requests", requestId);

      const nextItems = calculatedItems.map((item) => {
        const {
          __rowId,
          quantity,
          listPrice,
          specialPrice,
          effectiveUnitPrice,
          lineListTotal,
          lineSpecialTotal,
          ...rest
        } = item;

        return {
          ...rest,
          quantity,
          qtyOffered: quantity,
          listPrice,
          price: listPrice,
          specialPrice: specialPrice == null ? null : specialPrice,
          requestedPrice: specialPrice == null ? null : specialPrice,
          lineSpecialTotal,
          lineTotal: lineSpecialTotal,
          pricing: {
            listUnitPrice: listPrice,
            offeredUnitPrice: effectiveUnitPrice,
            lineListTotal,
            lineFinalTotal: lineSpecialTotal,
          },
        };
      });

      await updateDoc(ref, {
        items: nextItems,
        notes: {
          internalNote,
          customerNote,
        },
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
        notes: {
          internalNote,
          customerNote,
        },
        pricing: {
          listAmount: totals.listAmount,
          finalAmount: totals.finalAmount,
          discountAmount: totals.discountAmount,
          globalDiscountType: "none",
          globalDiscountValue: 0,
          globalDiscountAmount: totals.discountAmount,
        },
      }));

      alert("Teklif güncellendi.");
    } catch (error) {
      console.error("Teklif kaydedilemedi:", error);
      alert("Teklif kaydedilemedi.");
    } finally {
      setSavingForm(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Yükleniyor...</div>;
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          Teklif bulunamadı.
        </div>
      </div>
    );
  }

  const customer = data.customer || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Teklif Detayı</h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/satissitok/admin/quotes")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Listeye Dön
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={savingForm}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {savingForm ? "Kaydediliyor..." : "Teklifi Kaydet"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="text-sm text-slate-500">Ad Soyad</div>
            <div className="text-base font-semibold text-slate-900">
              {getCustomerName(customer)}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-500">Firma</div>
            <div className="text-base font-semibold text-slate-900">
              {getCompanyName(customer)}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-500">Telefon</div>
            <div className="text-base font-semibold text-slate-900">
              {customer?.phone || "-"}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-500">E-posta</div>
            <div className="text-base font-semibold text-slate-900">
              {customer?.email || "-"}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-500">Tarih</div>
            <div className="text-base font-semibold text-slate-900">
              {formatDate(data.createdAt || data.requestMeta?.submittedAt)}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-500">Mevcut Durum</div>
            <div className="text-base font-semibold text-slate-900">
              {data.status || "new"}
            </div>
          </div>
        </div>

        {data?.requestMeta?.customerMessage ? (
          <div className="mt-5">
            <div className="text-sm text-slate-500">Müşteri Mesajı</div>
            <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {data.requestMeta.customerMessage}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-lg font-semibold text-slate-900">Durum</div>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => {
            const active = (data.status || "new") === status.key;

            return (
              <button
                key={status.key}
                type="button"
                disabled={savingStatus}
                onClick={() => updateStatus(status.key)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-blue-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
          <div className="text-lg font-semibold text-slate-900">Ürünler</div>
          <div className="text-sm text-slate-500">
            Toplam satır: {calculatedItems.length}
          </div>
        </div>

        {calculatedItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Ürün yok.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-3 py-3 font-semibold text-slate-700">Ürün</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">SKU</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Marka</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Miktar</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Liste Fiyatı</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Özel Fiyat</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Satır Toplamı</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">İşlem</th>
                </tr>
              </thead>

              <tbody>
                {calculatedItems.map((item) => {
                  return (
                    <tr
                      key={item.__rowId}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="px-3 py-3 text-slate-800">
                        <div className="font-medium">{getItemName(item)}</div>
                        {item?.slug ? (
                          <div className="mt-1 text-xs text-slate-400">
                            {item.slug}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {getItemSku(item)}
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {item?.brand || "-"}
                      </td>

                      <td className="px-3 py-3">
  <input
    type="number"
    min="0"
    value={item.quantity ?? ""}
    onChange={(e) =>
      updateItemValue(
        item.__rowId,
        "quantity",
        normalizeNumberInput(e.target.value)
      )
    }
    className="w-24 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
  />
</td>

<td className="px-3 py-3">
  <input
    type="number"
    min="0"
    value={item.listPrice ?? ""}
    onChange={(e) =>
      updateItemValue(
        item.__rowId,
        "listPrice",
        normalizeNumberInput(e.target.value)
      )
    }
    className="w-32 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
  />
</td>

<td className="px-3 py-3">
  <input
    type="number"
    min="0"
    value={item.specialPrice ?? ""}
    placeholder="Boş = liste"
    onChange={(e) =>
      updateItemValue(
        item.__rowId,
        "specialPrice",
        normalizeNumberInput(e.target.value)
      )
    }
    className="w-32 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
  />
</td>

                      <td className="px-3 py-3 font-semibold text-slate-900">
                        <div>{formatMoney(item.lineSpecialTotal)}</div>

                        {item.specialPrice != null &&
                        item.specialPrice !== "" &&
                        Number(item.specialPrice) !== Number(item.listPrice) ? (
                          <div className="mt-1 text-xs text-slate-400 line-through">
                            {formatMoney(item.lineListTotal)}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.__rowId)}
                          className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">
            İç Not
          </div>
          <textarea
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"
            placeholder="Sadece yönetici görür..."
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">
            Müşteriye Görünen Not
          </div>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"
            placeholder="Müşteriye gösterilecek açıklama..."
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-900">Toplamlar</div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Liste Toplamı</div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {formatMoney(totals.listAmount)}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm text-slate-500">İndirim Tutarı</div>
            <div className="mt-1 text-xl font-bold text-green-700">
              {formatMoney(totals.discountAmount)}
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-4">
            <div className="text-sm text-slate-500">Nihai Toplam</div>
            <div className="mt-1 text-2xl font-bold text-blue-800">
              {formatMoney(totals.finalAmount)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}