// app/satissitok/services/saleService.js
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

async function generateInvoiceNo(transaction, saleType) {
  const id =
    saleType === "official"
      ? "sale_official"
      : "sale_actual";

  const ref = doc(db, "sale_counters", id);
  const snap = await transaction.get(ref);

  let next = 1;
  if (snap.exists()) {
    next = Number(snap.data().lastNo || 0) + 1;
  }

  transaction.set(
    ref,
    { lastNo: next, updatedAt: serverTimestamp() },
    { merge: true }
  );

  return `${saleType === "official" ? "RS" : "FS"}-${String(
    next
  ).padStart(6, "0")}`;
}

export async function createSale(payload) {
  return await runTransaction(db, async (transaction) => {
    const {
      saleType,
      docNo,
      docDate,
      cariId,
      vatRate,
      vatMode,
      items,
    } = payload;

    const saleNo =
      docNo && docNo.trim()
        ? docNo.trim()
        : await generateInvoiceNo(transaction, saleType);

    const saleRef = doc(collection(db, "sales"));

    let netTotal = 0,
      vatTotal = 0,
      grossTotal = 0;

    items.forEach((i) => {
      netTotal += Number(i.net || 0);
      vatTotal += Number(i.vat || 0);
      grossTotal += Number(i.total || 0);
    });

    transaction.set(saleRef, {
      saleNo,
      saleType,
      cariId,
      vatRate,
      vatMode,
      netTotal,
      vatTotal,
      grossTotal,
      status: "completed",
      documentDate: docDate ? new Date(docDate) : null,
      createdAt: serverTimestamp(),
    });

    return { saleId: saleRef.id };
  });
}
