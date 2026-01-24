// app/profile/orders/[id]/page.jsx

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import { useLang } from "../../../context/LanguageContext";
import { getT } from "../../../lib/i18n";
import { db } from "../../../../firebase";

import { doc, getDoc } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

export default function OrderDetailPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = getT(lang);
  const params = useParams();
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const storage = getStorage();
  const orderId = params?.id;

  const formatDate = (ts) => {
    if (!ts) return "-";
    const date =
      typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return date.toLocaleString(lang === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resolveItemImages = async (items = []) => {
    return Promise.all(
      items.map(async (item) => {
        if (!item.image) return { ...item, imageUrl: null };

        if (typeof item.image === "string" && item.image.startsWith("http")) {
          return { ...item, imageUrl: item.image };
        }

        try {
          const url = await getDownloadURL(
            ref(storage, `product_images/${item.image}`)
          );
          return { ...item, imageUrl: url };
        } catch {
          return { ...item, imageUrl: null };
        }
      })
    );
  };

  const loadOrder = async () => {
    if (!user || !orderId) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const refDoc = doc(db, "users", user.uid, "orders", orderId);
      const snap = await getDoc(refDoc);

      if (!snap.exists()) {
        setErrorMsg(t("orders.notFound"));
        setOrder(null);
        setLoading(false);
        return;
      }

      const data = snap.data();
      const itemsWithImages = await resolveItemImages(data.items || []);

      setOrder({
        id: snap.id,
        ...data,
        items: itemsWithImages,
      });
    } catch (err) {
      console.error(err);
      setErrorMsg(t("orders.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadOrder();
  }, [user, orderId]);

  const steps = [
    { key: "pending", labelKey: "pending" },
    { key: "preparing", labelKey: "preparing" },
    { key: "on_the_way", labelKey: "on_the_way" },
    { key: "delivered", labelKey: "delivered" },
  ];

  const currentStepIndex = order
    ? steps.findIndex((s) => s.key === order.status)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("orders.detailTitle")}
          </h1>
          {order && (
            <p className="text-sm text-gray-500 break-all">
              {t("orders.orderNo")}{" "}
              <span className="font-medium">{order.orderNumber}</span>
              {" · "}
              {formatDate(order.createdAt)}
            </p>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => router.back()}
            className="flex-1 md:flex-none px-3 py-2 text-sm border rounded-lg"
          >
            {t("common.back")}
          </button>

          <Link
            href="/profile/orders"
            className="flex-1 md:flex-none px-3 py-2 text-sm border rounded-lg text-center"
          >
            {t("orders.all")}
          </Link>
        </div>
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {errorMsg && !loading && (
        <p className="text-red-600 text-sm">{errorMsg}</p>
      )}

      {!loading && order && (
        <>
          {/* STATUS */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold mb-3">
              {t("orders.statusTitle")}
            </h2>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-2">
              {steps.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isPassed = index < currentStepIndex;

                return (
                  <div
                    key={step.key}
                    className="w-full md:flex-1 flex items-center min-w-0"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border ${
                        isActive
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-400 border-gray-300"
                      }`}
                    >
                      {index + 1}
                    </div>

                    <span className="ml-2 text-xs md:text-sm text-gray-700 truncate">
                      {t(`orders.statusLabels.${step.labelKey}`)}
                    </span>

                    {index < steps.length - 1 && (
                      <div
                        className={`hidden md:block flex-1 h-[2px] mx-2 ${
                          isPassed ? "bg-emerald-600" : "bg-gray-200"
                        }`}
                      ></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* CONTENT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4 md:col-span-1">
              {order.address && (
                <div className="bg-white p-4 rounded-xl shadow space-y-1">
                  <h2 className="font-semibold mb-2">
                    {t("orders.deliveryAddress")}
                  </h2>

                  {order.address.fullName && (
                    <p className="font-medium break-words">
                      {order.address.fullName}
                    </p>
                  )}

                  {order.address.phone && (
                    <p className="text-sm text-gray-700 break-all">
                      {t("orders.phone")}: {order.address.phone}
                    </p>
                  )}

                  <p className="text-sm text-gray-700 break-words">
                    {order.address.city && `${order.address.city}, `}
                    {order.address.street}
                    {order.address.building &&
                      ` ${order.address.building}`}
                  </p>

                  {order.address.details && (
                    <p className="text-xs text-gray-500 mt-1 break-words">
                      {order.address.details}
                    </p>
                  )}
                </div>
              )}

              <div className="bg-white p-4 rounded-xl shadow space-y-1 text-sm">
                <h2 className="font-semibold mb-2">
                  {t("orders.paymentSummary")}
                </h2>

                <div className="flex justify-between">
                  <span>{t("orders.subtotal")}</span>
                  <span>{order.subtotal?.toLocaleString()} ₸</span>
                </div>

                {order.hasDiscount && order.discountRate > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>
                      {t("orders.discount")} (%{order.discountRate})
                    </span>
                    <span>
                      -{order.discountAmount?.toLocaleString()} ₸
                    </span>
                  </div>
                )}

                <div className="flex justify-between font-semibold mt-1">
                  <span>{t("orders.total")}</span>
                  <span>{order.grandTotal?.toLocaleString()} ₸</span>
                </div>
              </div>
            </div>

            {/* PRODUCTS */}
            <div className="md:col-span-2">
              <div className="bg-white p-4 rounded-xl shadow">
                <h2 className="font-semibold mb-3">
                  {t("orders.products")}
                </h2>

                {order.items && order.items.length > 0 && (
                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div
                        key={`${item.productId}-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3 last:border-b-0"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <img
                            src={item.imageUrl || "/no-image.png"}
                            alt={item.name}
                            className="w-16 h-16 rounded-lg object-contain bg-gray-100 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-medium break-words">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t("orders.quantity")}: {item.quantity}
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right text-sm flex-shrink-0">
                          <p className="text-gray-700">
                            {t("orders.unit")}:{" "}
                            {item.price?.toLocaleString()} ₸
                          </p>
                          <p className="font-semibold text-indigo-600">
                            {t("orders.itemTotal")}:{" "}
                            {item.total?.toLocaleString()} ₸
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
