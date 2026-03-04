// app/satissitok/services/expenseCategoryService.js
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

export async function listExpenseCategories() {
  const q = query(
    collection(db, "expense_categories"),
    orderBy("order", "asc"),
    orderBy("name", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createExpenseCategory({ name, order = 100, active = true }) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("Kategori adı zorunlu");
  const ref = await addDoc(collection(db, "expense_categories"), {
    name: clean,
    order: Number(order) || 100,
    active: active !== false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}