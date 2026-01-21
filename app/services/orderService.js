// app/services/orderService.js

// app/lib/orderService.js
"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase"; // kendi yoluna göre düzelt

// 🔹 Kullanıcı indirimini oku
export async function getUserDiscountRate(uid) {
  const ref = doc(db, "discounts", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null; // indirim yok → kullanıcı hiçbir şey görmeyecek
  }

  const data = snap.data();
  const rate = data?.discountRate;

  if (typeof rate !== "number" || rate <= 0) {
    return null; // 0 veya negatifse de yok say
  }

  return rate; // örn: 20 (yani %20)
}

// 🔹 Sipariş numarası üret
function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const tail = String(now.getTime()).slice(-5);
  return `HL-${y}${m}${d}-${tail}`;
}

// 🔹 Sepetten sipariş oluştur + sepeti temizle
export async function createOrderFromBasket(uid, activeAddress) {
  // 1) Kullanıcının sepetini çek
  const basketRef = collection(db, "users", uid, "basket");
  const basketSnap = await getDocs(basketRef);

  if (basketSnap.empty) {
    throw new Error("Sepet boş, sipariş oluşturulamaz.");
  }

  const items = [];
  let subtotal = 0;

  basketSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const quantity = data.quantity || 1;
    const price = data.price || 0;
    const total = price * quantity;

    subtotal += total;

    items.push({
      productId: data.productId || docSnap.id,
      name: data.name,
      image: data.image || null, // sepet dokümanında nasıl tutuyorsan
      price,
      quantity,
      total,
    });
  });

  // 2) Kullanıcı indirimini oku
  const discountRate = await getUserDiscountRate(uid); // örn 20 veya null

  let hasDiscount = false;
  let discountAmount = 0;
  let grandTotal = subtotal;

  if (discountRate !== null) {
    hasDiscount = true;
    discountAmount = Math.round((subtotal * discountRate) / 100);
    grandTotal = subtotal - discountAmount;
  }

  // 3) Sipariş dokümanı oluştur
  const ordersCol = collection(db, "users", uid, "orders");
  const orderDocRef = doc(ordersCol); // otomatik id
  const orderNumber = generateOrderNumber();

  const orderData = {
    id: orderDocRef.id,
    orderNumber,
    userId: uid,
    status: "pending", // Sipariş alındı

    address: {
      fullName: activeAddress.fullName || "",
      phone: activeAddress.phone || "",
      city: activeAddress.city || "",
      street: activeAddress.street || "",
      building: activeAddress.building || "",
      details: activeAddress.details || "",
    },

    items,
    subtotal,
    hasDiscount,
    discountRate: hasDiscount ? discountRate : 0,
    discountAmount,
    grandTotal,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(orderDocRef, orderData);

  // 4) Sepeti temizle
  const deletePromises = [];
  basketSnap.forEach((docSnap) => {
    deletePromises.push(deleteDoc(docSnap.ref));
  });
  await Promise.all(deletePromises);

  return orderData; // UI tarafında kullanmak istersen
}
