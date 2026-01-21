// app/profile/orders/page.jsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { getT } from "../../lib/i18n";

import { db } from "../../../firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

// Durum yazıları
const STATUS_LABELS = {
  pending: "pending",
  preparing: "preparing",
  on_the_way: "on_the_way",
  delivered: "delivered",
};

export default function OrdersPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = getT(lang);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Firestore timestamp -> okunabilir tarih
  const formatDate = (ts) => {
    if (!ts) return "-";
    const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return date.toLocaleString(lang === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Siparişleri firestore'dan çek
  const loadOrders = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const ref = collection(db, "users", user.uid, "orders");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const arr = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setOrders(arr);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadOrders();
  }, [user]);

  // Durum adım sayısı (progress bar)
  const getStepIndex = (status) => {
    switch (status) {
      case "pending":
        return 1;
      case "preparing":
        return 2;
      case "on_the_way":
        return 3;
      case "delivered":
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-4">
        {t("orders.title")}
      </h1>

      {loading && <p>{t("common.loading")}</p>}

      {!loading && orders.length === 0 && (
        <p className="text-gray-500">
          {t("orders.empty")}
        </p>
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const step = getStepIndex(order.status);

          return (
            <Link
              key={order.id}
              href={`/profile/orders/${order.id}`}
              className="block bg-white p-4 md:p-5 rounded-xl shadow hover:shadow-md transition border border-gray-100"
            >
              {/* Üst satır */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-800 text-lg">
                    {t("orders.orderNo")}: {order.orderNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-indigo-600">
                    {order.grandTotal?.toLocaleString()} ₸
                  </p>
                </div>
              </div>

              {/* Durum */}
              <div className="mt-4">
                <p className="text-sm text-gray-700 font-medium mb-1">
                  {t("orders.status")}:{" "}
                  {t(`orders.statusLabels.${STATUS_LABELS[order.status]}`)}
                </p>

                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-1 flex-1">
                      <div
                        className={`w-6 h-6 rounded-full text-xs flex items-center justify-center border  
                          ${
                            i <= step
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-gray-400 border-gray-300"
                          }`}
                      >
                        {i}
                      </div>

                      {i < 4 && (
                        <div
                          className={`h-[2px] flex-1 ${
                            i < step ? "bg-emerald-600" : "bg-gray-200"
                          }`}
                        ></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
