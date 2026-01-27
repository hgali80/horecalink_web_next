// app/satissitok/admin/cari/services/cariService.js

import {
  collection,
  doc,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";

const COL = "caris";
const TX_COL = "cari_transactions";

// ------------------------------------
// CARI KART
// ------------------------------------
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

// ------------------------------------
// CARI HAREKETLER
// ------------------------------------

/**
 * Cari hareket oluştur
 * type: debit (borç) | credit (alacak)
 */
export async function createCariTransaction(
  transaction,
  {
    cariId,
    type,
    source,
    refId,
    amount,
  }
) {
  if (!cariId || !type || !amount) {
    throw new Error("Cari işlem bilgisi eksik");
  }

  const ref = doc(collection(db, TX_COL));

  transaction.set(ref, {
    cariId,
    type,
    source,
    refId: refId || null,
    amount: Number(amount),
    createdAt: serverTimestamp(),
  });
}

/**
 * Cari hareketleri listele
 */
export async function listCariTransactionsByCari(cariId) {
  const q = query(
    collection(db, TX_COL),
    where("cariId", "==", cariId),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * Cari bakiye hesapla
 * debit  => +
 * credit => -
 */
export async function getCariBalance(cariId) {
  const q = query(
    collection(db, TX_COL),
    where("cariId", "==", cariId)
  );

  const snap = await getDocs(q);

  let balance = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    const amt = Number(d.amount) || 0;

    if (d.type === "debit") balance += amt;
    if (d.type === "credit") balance -= amt;
  });

  return Math.round(balance * 100) / 100;
}
