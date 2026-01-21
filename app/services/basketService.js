//app/services/basketService.js

// app/services/basketService.js

import { db } from "../../firebase";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  collection,
} from "firebase/firestore";

export const addToBasket = async (userId, product) => {
  const ref = doc(db, "users", userId, "basket", product.id);

  await setDoc(ref, {
    productId: product.id,
    name: product.name,
    price: product.price,
    image: product.image || "",
    quantity: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

export const updateBasketQuantity = async (userId, productId, quantity) => {
  const ref = doc(db, "users", userId, "basket", productId);
  await updateDoc(ref, {
    quantity,
    updatedAt: new Date(),
  });
};

export const removeFromBasket = async (userId, productId) => {
  await deleteDoc(doc(db, "users", userId, "basket", productId));
};

export const getBasketItems = async (userId) => {
  const basketRef = collection(db, "users", userId, "basket");
  const snapshot = await getDocs(basketRef);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};
