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

// 🔵 Sipariş servisi
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

  // 🔵 Görsel URL çözümleme
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

  // 🔵 Kullanıcı indirimi
  const loadDiscount = async () => {
    if (!user) return;
    const rate = await getUserDiscountRate(user.uid);
    setDiscountRate(rate);
  };

  // 🔵 Aktif adres
  const loadActiveAddress = async () => {
    if (!user) return;

    const refCol = collection(db, "users", user.uid, "addresses");
    const snap = await getDocs(refCol);

    if (snap.empty) {
      setActiveAddress(null);
      return;
    }

    const addresses = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const defaultAddress = addresses.find((a) => a.isDefault === true);
    setActiveAddress(defaultAddress || addresses[0]);
  };

  // 🔵 Sepeti yükle
  const loadBasket = async () => {
    if (!user) return;

    const refCol = collection(db, "users", user.uid, "basket");
    const snap = await getDocs(refCol);

    const rawItems = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const withImages = await resolveImages(rawItems);
    setItems(withImages);
  };

  useEffect(() => {
    if (!user) return;

    loadBasket();
    loadDiscount();
    loadActiveAddress();
  }, [user]);

  // 🔵 Miktar
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

  // 🔵 Sil
  const removeItem = async (id) => {
    await deleteDoc(doc(db, "users", user.uid, "basket", id));
    loadBasket();
  };

  // 🔵 Toplamlar
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  let discountAmount = 0;
  let grandTotal = subtotal;

  if (discountRate !== null) {
    discountAmount = Math.round((subtotal * discountRate) / 100);
    grandTotal = subtotal - discountAmount;
  }

  // 🔵 Sipariş oluştur
  const handleCreateOrder = async () => {
    if (!user) return;

    if (!activeAddress) {
      setErrorMsg(t("basket.error.noAddress"));
      return;
    }

    setErrorMsg("");
    setOrderSuccess(null);
    setLoadingOrder(true);

    try {
      const order = await createOrderFromBasket(user.uid, activeAddress);
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
    <div className="p-4 md:p-6">
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
            className="bg-white p-4 shadow rounded-xl flex justify-between items-center"
          >
            <Link
              href={`/products/${item.id}`}
              className="flex items-center gap-4 flex-1"
            >
              <img
                src={item.imageUrl || "/no-image.png"}
                className="w-20 h-20 rounded-lg object-contain bg-gray-100"
              />

              <div>
                <p className="font-medium">{item.name}</p>

                <p className="text-gray-700">
                  {t("basket.unitPrice")}:{" "}
                  {item.price.toLocaleString()} ₸
                </p>

                <p className="font-semibold text-indigo-600 mt-1">
                  {t("basket.itemTotal")}:{" "}
                  {(item.price * item.quantity).toLocaleString()} ₸
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={() => updateQty(item.id, item.quantity - 1)}
                className="px-3 py-1 border rounded"
              >
                -
              </button>

              <span className="font-semibold">{item.quantity}</span>

              <button
                onClick={() => updateQty(item.id, item.quantity + 1)}
                className="px-3 py-1 border rounded"
              >
                +
              </button>

              <button
                onClick={() => removeItem(item.id)}
                className="text-red-500 ml-4"
              >
                {t("basket.remove")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="mt-6 bg-white p-4 shadow rounded-xl space-y-2 text-right">
          <p className="text-gray-700">
            {t("basket.subtotal")}: {subtotal.toLocaleString()} ₸
          </p>

          {discountRate !== null && (
            <p className="text-emerald-600 font-medium">
              {t("basket.discount", { rate: discountRate })}: -
              {discountAmount.toLocaleString()} ₸
            </p>
          )}

          <p className="text-xl font-bold">
            {t("basket.total")}: {grandTotal.toLocaleString()} ₸
          </p>

          <button
            onClick={handleCreateOrder}
            disabled={loadingOrder}
            className="w-full mt-4 bg-slate-900 text-white py-3 rounded-lg disabled:opacity-50"
          >
            {loadingOrder
              ? t("basket.creatingOrder")
              : t("basket.createOrder")}
          </button>

          {errorMsg && (
            <p className="text-red-600 mt-2">{errorMsg}</p>
          )}

          {orderSuccess && (
            <p className="text-green-600 mt-2">
              {t("basket.success")}{" "}
              <b>{orderSuccess.orderNumber}</b>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
