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
  Timestamp,
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
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
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
 * direction: debit (borç) | credit (alacak)
 */
export async function createCariTransaction(
  transaction,
  {
    cariId,

    // canonical
    direction, // debit | credit
    operationType, // sale_invoice | sale_payment | purchase_invoice | purchase_cancel | payment_in | payment_out | ...
    documentNo,

    // finance extensions (optional)
    receiptNo,
    accountId,
    method,
    settlement,

    // legacy (backward compat)
    type,
    source,

    refId,
    amount,
    operationDate,
    currency,
    note,
    paymentMethod,
  }
) {
  // backward compatibility:
  // - old calls send { type, source }
  // - new calls send { direction, operationType }
  const dir = (direction || type || "").toString().trim();

  // source -> operationType mapping (legacy)
  const opType =
    (operationType || "").toString().trim() ||
    (function mapSourceToOpType(s) {
      const src = (s || "").toString().trim();
      if (!src) return "";
      if (src === "sale") return "sale_invoice";
      if (src === "sale_payment") return "sale_payment";
      if (src === "purchase") return "purchase_invoice";
      if (src === "purchase_cancel") return "purchase_cancel";
      return src; // unknowns kept normalized
    })(source);

  const amt = Number(amount);

  if (!cariId || !dir || !Number.isFinite(amt) || amt <= 0) {
    throw new Error("Cari işlem bilgisi eksik");
  }
  if (!opType) {
    throw new Error("operationType zorunlu");
  }

  const ref = doc(collection(db, TX_COL));

  transaction.set(ref, {
    cariId,

    // canonical
    direction: dir,
    operationType: opType,
    documentNo: (documentNo ?? null) || null,

    // finance extensions
    receiptNo: receiptNo || null,
    accountId: accountId || null,
    method: method || null,
    settlement: settlement && typeof settlement === "object" ? settlement : null,

    refId: refId || null,
    amount: amt,
    currency: currency || "KZT",
    paymentMethod: paymentMethod || null,
    note: note || "",
    operationDate: Timestamp.fromDate(operationDate ? new Date(operationDate) : new Date()),

    // legacy aliases (do not rely on these in reports)
    type: dir,
    source: source || null,

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
  const q = query(collection(db, TX_COL), where("cariId", "==", cariId));
  const snap = await getDocs(q);

  let balance = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    const amt = Number(d.amount) || 0;
    const dir = d.direction || d.type;

    if (dir === "debit") balance += amt;
    if (dir === "credit") balance -= amt;
  });

  return Math.round(balance * 100) / 100;
}