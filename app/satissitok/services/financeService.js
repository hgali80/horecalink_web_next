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
import { writeDocumentSettlement, writeDocumentSettlements } from "./documentSettlementService";

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round(num(value) * 100) / 100;
}

function toTS(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return Timestamp.fromDate(d);
}

function normalizeSettlementLines({ invoiceId, invoiceNo, amount, settlementLines }) {
  const rows = Array.isArray(settlementLines)
    ? settlementLines
        .map((row) => ({
          invoiceId: String(row?.invoiceId || "").trim(),
          invoiceNo: String(row?.invoiceNo || "").trim() || null,
          amount: round2(row?.amount),
        }))
        .filter((row) => row.invoiceId && row.amount > 0)
    : [];

  if (rows.length > 0) return rows;
  if (!invoiceId) return [];

  return [
    {
      invoiceId,
      invoiceNo: invoiceNo || null,
      amount: round2(amount),
    },
  ].filter((row) => row.amount > 0);
}

export async function writeCashMovementTransaction(transaction, payload) {
  const kind = String(payload?.kind || "").trim();
  if (kind !== "collect" && kind !== "pay") {
    throw new Error("kind zorunlu: collect | pay");
  }

  const cariId = String(payload?.cariId || "").trim();
  if (!cariId) throw new Error("cariId zorunlu");

  const amount = round2(payload?.amount);
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
  const settlementLines = normalizeSettlementLines({
    invoiceId,
    invoiceNo,
    amount,
    settlementLines: payload?.settlementLines,
  });
  const allocatedAmount = round2(
    settlementLines.reduce((sum, row) => sum + round2(row.amount), 0)
  );

  if (mode !== "advance" && settlementLines.length > 0 && Math.abs(allocatedAmount - amount) > 0.001) {
    throw new Error("Dagitim toplami tahsilat tutari ile ayni olmali");
  }

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

  const { receiptNo } = await reserveNextReceiptNo({
    transaction,
    kind: kind === "collect" ? "collect" : "pay",
    dateISO: operationDateISO,
  });

  const description = String(payload?.description || "").trim() || null;
  const singleSettlement = settlementLines.length === 1 ? settlementLines[0] : null;
  const documentNo = singleSettlement?.invoiceNo || invoiceNo || null;

  const cashRef = doc(collection(db, "cash_transactions"));

  createCariTransaction(transaction, {
    cariId,
    direction,
    operationType,
    documentNo,
    receiptNo,
    accountId,
    method,
    settlement: singleSettlement
      ? {
          invoiceId: singleSettlement.invoiceId,
          invoiceNo: singleSettlement.invoiceNo || null,
        }
      : null,
    amount,
    operationDate: operationDateISO,
    currency: "KZT",
    note:
      description ||
      `${kind === "collect" ? "Tahsilat" : "Odeme"} (${method})${
        documentNo ? ` - ${documentNo}` : settlementLines.length > 1 ? " - Coklu belge" : ""
      }`,
    paymentMethod: method,
    type: direction,
    source: operationType,
    refId: singleSettlement?.invoiceId || null,
  });

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
      kind:
        settlementLines.length > 1
          ? kind === "collect"
            ? "sale_multi"
            : "purchase_multi"
          : singleSettlement?.invoiceId
          ? kind === "collect"
            ? "sale"
            : "purchase"
          : "cari",
      id: singleSettlement?.invoiceId || null,
    },
    settlement: singleSettlement
      ? {
          invoiceId: singleSettlement.invoiceId,
          invoiceNo: singleSettlement.invoiceNo || null,
        }
      : null,
    settlementLines,
    description,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  let settlement = null;
  if (settlementLines.length > 0 && mode !== "advance") {
    if (settlementLines.length === 1) {
      settlement = await writeDocumentSettlement({
        transaction,
        kind: invoiceKind || (kind === "collect" ? "sale" : "purchase"),
        invoiceId: settlementLines[0].invoiceId,
        amount: settlementLines[0].amount,
        operationDate: operationDateISO,
        receiptNo,
        accountId,
        method,
        description,
        cashTxId: cashRef.id,
      });
    } else {
      settlement = await writeDocumentSettlements({
        transaction,
        kind: invoiceKind || (kind === "collect" ? "sale" : "purchase"),
        allocations: settlementLines,
        operationDate: operationDateISO,
        receiptNo,
        accountId,
        method,
        description,
        cashTxId: cashRef.id,
      });
    }
  }

  return { receiptNo, cashTxId: cashRef.id, settlement };
}

export async function createCashMovement(payload) {
  return runTransaction(db, async (transaction) =>
    writeCashMovementTransaction(transaction, payload)
  );
}
