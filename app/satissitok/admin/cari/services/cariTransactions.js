// app/satissitok/admin/cari/services/cariTransactions.js

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

export async function listCariTransactions({
  cariId,
  fromDate,
  toDate,
}) {
  if (!cariId) return [];

  const constraints = [
    where("cariId", "==", cariId),
    orderBy("operationDate", "asc"),
    orderBy("createdAt", "asc"),
  ];

  if (fromDate) {
    constraints.push(
      where(
        "operationDate",
        ">=",
        Timestamp.fromDate(new Date(fromDate))
      )
    );
  }

  if (toDate) {
    constraints.push(
      where(
        "operationDate",
        "<=",
        Timestamp.fromDate(new Date(toDate))
      )
    );
  }

  const q = query(collection(db, "cari_transactions"), ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}
