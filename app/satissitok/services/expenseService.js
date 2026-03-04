// app/satissitok/services/expenseService.js
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

export async function createExpense({
  operationDateISO,
  method,
  categoryId,
  categoryName,
  description,
  vatRate = 0,
  amountNet,
  amountGross,
  cariId = null,
}) {
  const vatR = round2(vatRate);
  const opDate = operationDateISO ? new Date(operationDateISO) : new Date();
  if (Number.isNaN(opDate.getTime())) throw new Error("Geçersiz tarih");

  // Eğer brüt girildiyse neti hesapla; net girildiyse brütü hesapla
  const net = round2(amountNet);
  const gross = round2(amountGross);

  let finalNet = net;
  let finalGross = gross;

  if (finalGross > 0 && finalNet <= 0) {
    finalNet = vatR > 0 ? round2(finalGross / (1 + vatR / 100)) : finalGross;
  }
  if (finalNet > 0 && finalGross <= 0) {
    finalGross = vatR > 0 ? round2(finalNet * (1 + vatR / 100)) : finalNet;
  }

  if (finalGross <= 0) throw new Error("Tutar zorunlu");

  const vatAmount = round2(finalGross - finalNet);

  const payload = {
    txType: "expense",
    direction: "out",
    operationDate: Timestamp.fromDate(opDate),

    method: (method || "").trim() || "-",
    description: (description || "").trim() || "",

    categoryId: categoryId || null,
    categoryName: (categoryName || "").trim() || "",

    vatRate: vatR,
    amountNet: finalNet,
    vatAmount,
    amountGross: finalGross,

    // cash page eski kolon: amount
    amount: finalGross,

    cariId: cariId || null,

    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "cash_transactions"), payload);
  return ref.id;
}

export async function createOtherIncome({
  operationDateISO,
  method,
  description,
  vatRate = 0,
  amountNet,
  amountGross,
  categoryId = null,
  categoryName = "",
  cariId = null,
}) {
  const vatR = round2(vatRate);
  const opDate = operationDateISO ? new Date(operationDateISO) : new Date();
  if (Number.isNaN(opDate.getTime())) throw new Error("Geçersiz tarih");

  const net = round2(amountNet);
  const gross = round2(amountGross);

  let finalNet = net;
  let finalGross = gross;

  if (finalGross > 0 && finalNet <= 0) {
    finalNet = vatR > 0 ? round2(finalGross / (1 + vatR / 100)) : finalGross;
  }
  if (finalNet > 0 && finalGross <= 0) {
    finalGross = vatR > 0 ? round2(finalNet * (1 + vatR / 100)) : finalNet;
  }

  if (finalGross <= 0) throw new Error("Tutar zorunlu");

  const vatAmount = round2(finalGross - finalNet);

  const payload = {
    txType: "other_income",
    direction: "in",
    operationDate: Timestamp.fromDate(opDate),

    method: (method || "").trim() || "-",
    description: (description || "").trim() || "",

    categoryId,
    categoryName: (categoryName || "").trim() || "",

    vatRate: vatR,
    amountNet: finalNet,
    vatAmount,
    amountGross: finalGross,

    amount: finalGross,

    cariId: cariId || null,

    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "cash_transactions"), payload);
  return ref.id;
}