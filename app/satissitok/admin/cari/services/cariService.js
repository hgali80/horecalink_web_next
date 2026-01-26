// app/satissitok/admin/cari/services/cariService.js

import {
  collection,
  doc,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase";

const COL = "caris";

export async function createCari(payload) {
  const ref = collection(db, COL);

  const docRef = await addDoc(ref, {
    type: payload.type, // supplier | customer | both
    firm: payload.firm || "",
    legalAddress: payload.legalAddress || "",
    bin: payload.bin || "",
    iban: payload.iban || "",
    bank: payload.bank || "",
    bic: payload.bic || "",
    kbe: payload.kbe || "",
    mobile: payload.mobile || "",
    director: payload.director || "",
    currency: payload.currency || "KZT",
    isActive: payload.isActive !== false,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function listCaris() {
  const q = query(
    collection(db, COL),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}
