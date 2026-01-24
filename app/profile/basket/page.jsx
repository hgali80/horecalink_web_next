// app/profile/basket/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { getT } from "../../lib/i18n";

import {
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../../firebase";

import { getStorage, ref, getDownloadURL } from "firebase/storage";
import Link from "next/link";

import {
  createOrderFromBasket,
  getUserDiscountRate,
} from "../../services/orderService";

export default function BasketPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = getT(lang);

  const [items, setItems] = useState([]);
  const [activeAddress, setActiveAddress] = useState(null);
  const [discountRate, setDiscountRate] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const storage = getStorage();

  const resolveImages = async (items) => {
    return Promise.all(
      items.map(async (item) => {
        if (!item.image) return { ...item, imageUrl: null };
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

  const loadDiscount = async () => {
    if (!user) return;
    const rate = await getUserDiscountRate(user.uid);
    setDiscountRate(rate);
  };

  const loadActiveAddress = async () => {
    if (!user) return;
    const snap = await getDocs(
      collection(db, "users", user.uid, "addresses")
    );
    if (snap.empty) return;
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setActiveAddress(list.find((a) => a.isDefault) || list[0]);
  };

  const loadBasket = async () => {
    if (!user) return;
    const snap = await getDocs(
      collection(db, "users", user.uid, "basket")
    );
    const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setItems(await resolveImages(raw));
  };

  useEffect(() => {
    if (!user) return;
    loadBasket();
    loadDiscount();
    loadActiveAddress();
  }, [user]);

  const updateQty = async (id, qty) => {
    if (qty <= 0) {
      await deleteDoc(doc(db, "users", user.uid, "basket", id));
      loadBasket();
      return;
    }
    await updateDoc(doc(db, "users", user.uid, "basket", id), {
      quantity: qty,
      updatedAt: new Date(),
    });
    loadBasket();
  };

  const removeItem = async (id) => {
    await deleteDoc(doc(db, "users", user.uid, "basket", id));
    loadBasket();
  };

  const subtotal = items.reduce(
    (s, i) => s + i.price * i.quantity,
    0
  );

  let discountAmount = 0;
  let grandTotal = subtotal;

  if (discountRate !== null) {
    discountAmount = Math.round(
      (subtotal * discountRate) / 100
    );
    grandTotal = subtotal - discountAmount;
  }

  const handleCreateOrder = async () => {
    if (!activeAddress) {
      setErrorMsg(t("basket.error.noAddress"));
      return;
    }
    setLoadingOrder(true);
    setErrorMsg("");
    try {
      const order = await createOrderFromBasket(
        user.uid,
        activeAddress
      );
      setOrderSuccess(order);
      loadBasket();
    } catch (err) {
      setErrorMsg(
        err.message || t("basket.error.createOrder")
      );
    } finally {
      setLoadingOrder(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">
        {t("basket.title")}
      </h1>

      {items.length === 0 && (
        <p className="text-gray-500">
          {t("basket.empty")}
        </p>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow p-4"
          >
            <Link
              href={`/products/${item.id}`}
              className="flex gap-4 items-start"
            >
              <img
                src={item.imageUrl || "/no-image.png"}
                className="w-24 h-24 rounded-lg bg-gray-100 object-contain flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-snug">
                  {item.name}
                </p>

                <p className="text-sm text-gray-600 mt-1">
                  {t("basket.unitPrice")}:{" "}
                  {item.price.toLocaleString()} ₸
                </p>

                <p className="text-sm font-semibold text-indigo-600 mt-1">
                  {t("basket.itemTotal")}:{" "}
                  {(item.price * item.quantity).toLocaleString()} ₸
                </p>
              </div>
            </Link>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    updateQty(item.id, item.quantity - 1)
                  }
                  className="w-9 h-9 border rounded-lg text-lg"
                >
                  −
                </button>

                <span className="font-semibold min-w-[24px] text-center">
                  {item.quantity}
                </span>

                <button
                  onClick={() =>
                    updateQty(item.id, item.quantity + 1)
                  }
                  className="w-9 h-9 border rounded-lg text-lg"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => removeItem(item.id)}
                className="text-sm text-red-500"
              >
                {t("basket.remove")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow p-4 space-y-2 text-right">
          <p>
            {t("basket.subtotal")}:{" "}
            {subtotal.toLocaleString()} ₸
          </p>

          {discountRate !== null && (
            <p className="text-emerald-600">
              {t("basket.discount", {
                rate: discountRate,
              })}: −{discountAmount.toLocaleString()} ₸
            </p>
          )}

          <p className="text-xl font-bold">
            {t("basket.total")}:{" "}
            {grandTotal.toLocaleString()} ₸
          </p>

          <button
            onClick={handleCreateOrder}
            disabled={loadingOrder}
            className="w-full mt-4 bg-slate-900 text-white py-3 rounded-lg"
          >
            {loadingOrder
              ? t("basket.creatingOrder")
              : t("basket.createOrder")}
          </button>

          {errorMsg && (
            <p className="text-red-600">{errorMsg}</p>
          )}

          {orderSuccess && (
            <p className="text-green-600">
              {t("basket.success")}{" "}
              <b>{orderSuccess.orderNumber}</b>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
