import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

import { reserveNextReceiptNo } from "./receiptCounterService";
import { createCariTransaction } from "@/app/satissitok/admin/cari/services/cariService";
import { writeDocumentSettlement } from "./documentSettlementService";

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function toTS(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return Timestamp.fromDate(d);
}

export async function writeCashMovementTransaction(transaction, payload) {
  const kind = String(payload?.kind || "").trim();
  if (kind !== "collect" && kind !== "pay") {
    throw new Error("kind zorunlu: collect | pay");
  }

  const cariId = String(payload?.cariId || "").trim();
  if (!cariId) throw new Error("cariId zorunlu");

  const amount = Math.round(num(payload?.amount) * 100) / 100;
  if (!(amount > 0)) throw new Error("Tutar 0'dan buyuk olmali");

  const method = String(payload?.method || "cash").trim() || "cash";
  const accountId = String(payload?.accountId || "").trim();
  if (!accountId) throw new Error("Hesap (accountId) zorunlu");

  const operationDateISO =
    payload?.operationDate || new Date().toISOString().slice(0, 10);

  const invoiceId = String(payload?.invoiceId || "").trim() || null;
  const invoiceNo = String(payload?.invoiceNo || "").trim() || null;
  const invoiceKind = String(payload?.invoiceKind || "").trim() || null;
  const mode = String(payload?.mode || "").trim();

  let operationType;
  let direction;
  let cashDir;

  if (kind === "collect") {
    cashDir = "in";
    if (mode === "advance") {
      operationType = "advance_received";
      direction = "credit";
    } else {
      operationType = "sale_payment";
      direction = "credit";
    }
  } else {
    cashDir = "out";
    if (mode === "advance") {
      operationType = "advance_paid";
      direction = "debit";
    } else {
      operationType = "purchase_payment";
      direction = "debit";
    }
  }

  /**
   * 🔴 1. TÜM READ’LER BURADA
   */

  const { receiptNo } = await reserveNextReceiptNo({
    transaction,
    kind: kind === "collect" ? "collect" : "pay",
    dateISO: operationDateISO,
  });

  const description = String(payload?.description || "").trim() || null;
  const documentNo = invoiceNo || null;

  /**
   * 🔵 2. WRITE BAŞLANGICI
   */

  const cashRef = doc(collection(db, "cash_transactions"));

  // 1) Cari hareketi
  createCariTransaction(transaction, {
    cariId,
    direction,
    operationType,
    documentNo,
    receiptNo,
    accountId,
    method,
    settlement: invoiceId ? { invoiceId, invoiceNo } : null,
    amount,
    operationDate: operationDateISO,
    currency: "KZT",
    note:
      description ||
      `${kind === "collect" ? "Tahsilat" : "Odeme"} (${method})${
        invoiceNo ? ` - ${invoiceNo}` : ""
      }`,
    paymentMethod: method,
    type: direction,
    source: operationType,
    refId: invoiceId || null,
  });

  // 2) Kasa hareketi
  transaction.set(cashRef, {
    accountId,
    direction: cashDir,
    amount,
    currency: "KZT",
    method,
    operationDate: toTS(operationDateISO),
    receiptNo,
    documentNo,
    cariId,
    ref: {
      kind: invoiceId ? (kind === "collect" ? "sale" : "purchase") : "cari",
      id: invoiceId,
    },
    settlement: invoiceId ? { invoiceId, invoiceNo } : null,
    description,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 3) Settlement (EN SON)
  let settlement = null;
  if (invoiceId && mode !== "advance") {
    settlement = await writeDocumentSettlement({
      transaction,
      kind: invoiceKind || (kind === "collect" ? "sale" : "purchase"),
      invoiceId,
      amount,
      operationDate: operationDateISO,
      receiptNo,
      accountId,
      method,
      description,
      cashTxId: cashRef.id,
    });
  }

  return { receiptNo, cashTxId: cashRef.id, settlement };
}

export async function createCashMovement(payload) {
  return runTransaction(db, async (transaction) =>
    writeCashMovementTransaction(transaction, payload)
  );
}