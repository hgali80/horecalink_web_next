"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/firebase";
import { ERP_COLLECTIONS } from "./erpCollections";
import { listErpDocuments } from "./erpDocumentsService";
import { assertErpCashAccountUsable, buildErpCashAccountWrite } from "./erpCashAccountRules";

function text(value) {
  return String(value ?? "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(num(value, 0) * 100) / 100;
}

function formatDate(value) {
  if (!value) return "-";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value?.seconds
          ? new Date(value.seconds * 1000)
          : new Date(value);

    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("tr-TR");
  } catch {
    return "-";
  }
}

function resolveSortTime(value) {
  if (!value) return 0;
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);
  const time = date?.getTime?.() ?? 0;
  return Number.isFinite(time) ? time : 0;
}

function getYear2(dateISO) {
  const date = dateISO ? new Date(dateISO) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return String(year).slice(-2);
}

async function reserveReceiptNumber({ transaction, dateISO }) {
  const yy = getYear2(dateISO);
  const ref = doc(db, ERP_COLLECTIONS.RECEIPT_COUNTERS, yy);
  const snap = await transaction.get(ref);
  const current = snap.exists() ? Number(snap.data()?.lastSeq || 0) : 0;
  const nextSeq = current + 1;

  transaction.set(
    ref,
    {
      yy,
      lastSeq: nextSeq,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return `TH-${yy}-${String(nextSeq).padStart(5, "0")}`;
}

export async function listErpCashAccounts() {
  const snap = await getDocs(collection(db, ERP_COLLECTIONS.CASH_ACCOUNTS));
  const rows = snap.docs.map((item) => {
    const data = item.data() || {};
    const openingBalance = num(data.openingBalance, 0);
    const currentBalance = num(data.currentBalance, openingBalance);
    return {
      id: item.id,
      code: text(data.code),
      name: text(data.name),
      type: text(data.type || "cash"),
      currency: text(data.currency || "KZT"),
      active: data.active !== false,
      openingBalance,
      currentBalance,
      updatedLabel: formatDate(data.updatedAt || data.createdAt),
      updatedTime: resolveSortTime(data.updatedAt || data.createdAt),
    };
  });

  rows.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.updatedTime - a.updatedTime;
  });

  return rows;
}

export async function listErpCashAccountOptions() {
  const rows = await listErpCashAccounts();
  return rows
    .filter((item) => item.name && item.active && item.currency.toUpperCase() === "KZT")
    .map((item) => ({
      value: item.id,
      label: `${item.name}${item.code ? ` (${item.code})` : ""} – ${item.currency}`,
      active: item.active,
    }));
}

export async function getErpCashAccount(accountId) {
  const ref = doc(db, ERP_COLLECTIONS.CASH_ACCOUNTS, accountId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Finans hesabi bulunamadi.");
  }
  return normalizeAccountDetail({ id: snap.id, ...(snap.data() || {}) });
}

export async function saveErpCashAccount(payload = {}) {
  const normalized = normalizeAccountPayload(payload);
  const ref = normalized.id
    ? doc(db, ERP_COLLECTIONS.CASH_ACCOUNTS, normalized.id)
    : doc(collection(db, ERP_COLLECTIONS.CASH_ACCOUNTS));

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (normalized.id && !snap.exists()) throw new Error("Finans hesabi bulunamadi.");
    const existing = snap.exists() ? snap.data() : null;
    const fields = buildErpCashAccountWrite(payload, existing);
    transaction.set(ref, {
      ...fields, updatedAt: serverTimestamp(),
      ...(!existing ? { createdAt: serverTimestamp() } : {}),
    }, { merge: true });
    return { ...existing, ...fields, id: ref.id };
  });
}

export async function listErpCashMovements(maxRows = 24) {
  const snap = await getDocs(
    query(collection(db, ERP_COLLECTIONS.CASH_MOVEMENTS), orderBy("createdAt", "desc"), limit(maxRows))
  );

  return snap.docs.map((item) => {
    const data = item.data() || {};
    const movementDate = data.movementDate || data.createdAt;
    return {
      id: item.id,
      direction: text(data.direction || "in"),
      kind: text(data.kind || "manual"),
      amount: num(data.amount, 0),
      currency: text(data.currency || "KZT"),
      cariName: text(data.cariName || data?.cariSnapshot?.name),
      accountName: text(data.accountName || data?.accountSnapshot?.name),
      documentNo: text(data.documentNo),
      receiptNo: text(data.receiptNo),
      dateLabel: formatDate(movementDate),
      sortTime: resolveSortTime(movementDate),
      notes: text(data.notes),
    };
  });
}

export async function listErpOpenDocuments(cariId = "") {
  const [sales, purchases] = await Promise.all([
    listErpDocuments(ERP_COLLECTIONS.SALES),
    listErpDocuments(ERP_COLLECTIONS.PURCHASES),
  ]);

  const rows = [
    ...sales.map((item) => ({ ...item, documentCollection: ERP_COLLECTIONS.SALES, documentKind: "sales" })),
    ...purchases.map((item) => ({ ...item, documentCollection: ERP_COLLECTIONS.PURCHASES, documentKind: "purchases" })),
  ]
    .filter((item) => item.status === "confirmed")
    .filter((item) => ["open", "partial"].includes(text(item.paymentStatus).toLowerCase()))
    .filter((item) => !cariId || text(item.cariId || item?.cariSnapshot?.id) === cariId)
    .map((item) => ({
      ...item,
      outstandingAmount: round2(
        item?.settlementSummary?.outstandingAmount ??
        (num(item.totalAmount, 0) - num(item?.settlementSummary?.settledAmount, 0))
      ),
      settledAmount: round2(item?.settlementSummary?.settledAmount),
    }))
    .sort((a, b) => b.sortTime - a.sortTime);

  return rows;
}

export async function createErpManualCashMovement(payload = {}) {
  const normalized = normalizeMovementPayload(payload);

  if (!normalized.accountId) {
    throw new Error("Kasa veya banka hesabi secmelisin.");
  }

  if (normalized.amount <= 0) {
    throw new Error("Tutar sifirdan buyuk olmali.");
  }

  return runTransaction(db, async (transaction) => {
    const accountRef = doc(db, ERP_COLLECTIONS.CASH_ACCOUNTS, normalized.accountId);
    const accountSnap = await transaction.get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Secilen finans hesabi bulunamadi.");
    }

    const accountData = accountSnap.data() || {};
    assertErpCashAccountUsable(accountData);
    if (normalized.currency !== "KZT") throw new Error("ERP hareket para birimi KZT olmali.");
    const currentBalance = num(accountData.currentBalance, num(accountData.openingBalance, 0));
    const nextBalance =
      normalized.direction === "in"
        ? currentBalance + normalized.amount
        : currentBalance - normalized.amount;

    const receiptNo = await reserveReceiptNumber({
      transaction,
      dateISO: normalized.movementDate,
    });

    const cashMovementRef = doc(collection(db, ERP_COLLECTIONS.CASH_MOVEMENTS));
    transaction.set(cashMovementRef, {
      kind: normalized.kind,
      direction: normalized.direction,
      amount: normalized.amount,
      currency: normalized.currency,
      movementDate: normalized.movementDate,
      accountId: normalized.accountId,
      accountName: text(accountData.name),
      accountSnapshot: {
        id: normalized.accountId,
        name: text(accountData.name),
        type: text(accountData.type),
      },
      cariId: normalized.cariId,
      cariName: normalized.cariName,
      cariSnapshot: normalized.cariName
        ? {
            id: normalized.cariId,
            name: normalized.cariName,
          }
        : null,
      method: normalized.method,
      notes: normalized.notes,
      receiptNo,
      createdAt: serverTimestamp(),
    });

    transaction.set(
      accountRef,
      {
        currentBalance: nextBalance,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (normalized.cariId) {
      const cariMovementRef = doc(collection(db, ERP_COLLECTIONS.CARI_MOVEMENTS));
      transaction.set(cariMovementRef, {
        cariId: normalized.cariId,
        cariName: normalized.cariName,
        movementKind: normalized.kind,
        direction: normalized.direction === "in" ? "alacak" : "borc",
        amount: normalized.amount,
        currency: normalized.currency,
        movementDate: normalized.movementDate,
        accountId: normalized.accountId,
        accountName: text(accountData.name),
        method: normalized.method,
        receiptNo,
        notes: normalized.notes,
        createdAt: serverTimestamp(),
      });
    }

    return { id: cashMovementRef.id, receiptNo };
  });
}

export async function createErpDocumentSettlement(payload = {}) {
  const normalized = normalizeSettlementPayload(payload);

  if (!normalized.documentId || !normalized.documentCollection) {
    throw new Error("Kapatilacak belgeyi secmelisin.");
  }

  if (!normalized.accountId) {
    throw new Error("Kasa veya banka hesabi secmelisin.");
  }

  if (normalized.amount <= 0) {
    throw new Error("Tutar sifirdan buyuk olmali.");
  }

  return runTransaction(db, async (transaction) => {
    const documentRef = doc(db, normalized.documentCollection, normalized.documentId);
    const documentSnap = await transaction.get(documentRef);
    if (!documentSnap.exists()) {
      throw new Error("Belge bulunamadi.");
    }

    const documentData = documentSnap.data() || {};
    const totalAmount = round2(documentData.totalAmount);
    const existingSummary = documentData.settlementSummary || {};
    const existingSettled = round2(existingSummary.settledAmount);
    const existingOutstanding = round2(
      existingSummary.outstandingAmount ?? Math.max(totalAmount - existingSettled, 0)
    );

    if (normalized.amount > existingOutstanding) {
      throw new Error("Girilen tutar belgenin kalan tutarindan buyuk olamaz.");
    }

    const accountRef = doc(db, ERP_COLLECTIONS.CASH_ACCOUNTS, normalized.accountId);
    const accountSnap = await transaction.get(accountRef);
    if (!accountSnap.exists()) {
      throw new Error("Secilen finans hesabi bulunamadi.");
    }

    const accountData = accountSnap.data() || {};
    assertErpCashAccountUsable(accountData);
    const currentBalance = num(accountData.currentBalance, num(accountData.openingBalance, 0));
    const isSales = normalized.documentCollection === ERP_COLLECTIONS.SALES;
    const direction = isSales ? "in" : "out";
    const cariDirection = isSales ? "alacak" : "borc";
    const nextBalance =
      direction === "in"
        ? currentBalance + normalized.amount
        : currentBalance - normalized.amount;

    const receiptNo = await reserveReceiptNumber({
      transaction,
      dateISO: normalized.movementDate,
    });

    const nextSettled = round2(existingSettled + normalized.amount);
    const nextOutstanding = round2(Math.max(totalAmount - nextSettled, 0));
    const nextStatus =
      nextOutstanding <= 0 ? "closed" : nextSettled > 0 ? "partial" : "open";

    const settlementRef = doc(collection(db, ERP_COLLECTIONS.DOCUMENT_SETTLEMENTS));
    transaction.set(settlementRef, {
      documentId: normalized.documentId,
      documentCollection: normalized.documentCollection,
      documentKind: isSales ? "sales" : "purchases",
      documentNo: text(documentData.documentNo),
      invoiceNo: text(documentData.invoiceNo),
      receiptNo,
      cariId: text(documentData.cariId || documentData?.cariSnapshot?.id),
      cariName: text(documentData.cariName || documentData?.cariSnapshot?.name),
      amount: normalized.amount,
      currency: "KZT",
      direction,
      method: normalized.method,
      accountId: normalized.accountId,
      accountName: text(accountData.name),
      status: "posted",
      settlementType: "manual_settlement",
      movementDate: normalized.movementDate,
      notes: normalized.notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const cashMovementRef = doc(collection(db, ERP_COLLECTIONS.CASH_MOVEMENTS));
    transaction.set(cashMovementRef, {
      settlementId: settlementRef.id,
      documentId: normalized.documentId,
      documentCollection: normalized.documentCollection,
      documentKind: isSales ? "sales" : "purchases",
      documentNo: text(documentData.documentNo),
      invoiceNo: text(documentData.invoiceNo),
      receiptNo,
      kind: "document_settlement",
      direction,
      amount: normalized.amount,
      currency: "KZT",
      movementDate: normalized.movementDate,
      method: normalized.method,
      accountId: normalized.accountId,
      accountName: text(accountData.name),
      accountSnapshot: {
        id: normalized.accountId,
        name: text(accountData.name),
        type: text(accountData.type),
      },
      cariId: text(documentData.cariId || documentData?.cariSnapshot?.id),
      cariName: text(documentData.cariName || documentData?.cariSnapshot?.name),
      cariSnapshot: documentData.cariSnapshot || null,
      notes: normalized.notes,
      createdAt: serverTimestamp(),
    });

    const cariMovementRef = doc(collection(db, ERP_COLLECTIONS.CARI_MOVEMENTS));
    transaction.set(cariMovementRef, {
      cariId: text(documentData.cariId || documentData?.cariSnapshot?.id),
      cariName: text(documentData.cariName || documentData?.cariSnapshot?.name),
      documentId: normalized.documentId,
      documentCollection: normalized.documentCollection,
      documentKind: isSales ? "sales" : "purchases",
      documentNo: text(documentData.documentNo),
      invoiceNo: text(documentData.invoiceNo),
      receiptNo,
      movementKind: "document_settlement",
      direction: cariDirection,
      amount: normalized.amount,
      currency: "KZT",
      method: normalized.method,
      accountId: normalized.accountId,
      accountName: text(accountData.name),
      movementDate: normalized.movementDate,
      notes: normalized.notes,
      createdAt: serverTimestamp(),
    });

    transaction.set(
      accountRef,
      {
        currentBalance: nextBalance,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      documentRef,
      {
        paymentStatus: nextStatus,
        settlementSummary: {
          invoiceAmount: totalAmount,
          settledAmount: nextSettled,
          outstandingAmount: nextOutstanding,
          status: nextStatus,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { receiptNo, settlementId: settlementRef.id };
  });
}

function normalizeMovementPayload(payload = {}) {
  return {
    kind: text(payload.kind || "manual"),
    direction: text(payload.direction).toLowerCase() === "out" ? "out" : "in",
    amount: round2(payload.amount),
    currency: text(payload.currency || "KZT"),
    movementDate: text(payload.movementDate) || new Date().toISOString().slice(0, 10),
    accountId: text(payload.accountId),
    cariId: text(payload.cariId),
    cariName: text(payload.cariName),
    method: text(payload.method),
    notes: text(payload.notes),
  };
}

function normalizeSettlementPayload(payload = {}) {
  return {
    documentId: text(payload.documentId),
    documentCollection: text(payload.documentCollection),
    accountId: text(payload.accountId),
    amount: round2(payload.amount),
    method: text(payload.method),
    movementDate: text(payload.movementDate) || new Date().toISOString().slice(0, 10),
    notes: text(payload.notes),
  };
}

function normalizeAccountPayload(payload = {}) {
  const openingBalance = num(payload.openingBalance, 0);
  const currentBalance = payload.currentBalance === "" ? openingBalance : num(payload.currentBalance, openingBalance);
  return {
    id: text(payload.id),
    code: text(payload.code),
    name: text(payload.name),
    type: text(payload.type || "cash"),
    currency: text(payload.currency || "KZT"),
    openingBalance,
    currentBalance,
    notes: text(payload.notes),
    active: payload.active !== false,
    createdAt: payload.createdAt || null,
  };
}

function normalizeAccountDetail(data = {}) {
  return {
    id: text(data.id),
    code: text(data.code),
    name: text(data.name),
    type: text(data.type || "cash"),
    currency: text(data.currency || "KZT"),
    openingBalance: num(data.openingBalance, 0),
    currentBalance: num(data.currentBalance, num(data.openingBalance, 0)),
    notes: text(data.notes),
    active: data.active !== false,
    createdAt: data.createdAt || null,
  };
}
