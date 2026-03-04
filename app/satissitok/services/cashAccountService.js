// app/satissitok/services/cashAccountService.js
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/firebase";

export async function listCashAccounts() {
  const q = query(collection(db, "cash_accounts"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getDefaultCashAccountId() {
  // 1) default==true
  const q1 = query(
    collection(db, "cash_accounts"),
    where("active", "!=", false),
    where("default", "==", true),
    limit(1)
  );
  const s1 = await getDocs(q1);
  if (!s1.empty) return s1.docs[0].id;

  // 2) first active
  const q2 = query(
    collection(db, "cash_accounts"),
    where("active", "!=", false),
    orderBy("name", "asc"),
    limit(1)
  );
  const s2 = await getDocs(q2);
  if (!s2.empty) return s2.docs[0].id;

  return null;
}
