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

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function tsToDate(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value?.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function pickDebitCredit(row) {
  const direction = (row?.direction || row?.type || "").toString().trim().toLowerCase();
  const amount = num(row?.amount);

  if (direction === "debit") return { debit: amount, credit: 0 };
  if (direction === "credit") return { debit: 0, credit: amount };

  return {
    debit: num(row?.debit),
    credit: num(row?.credit),
  };
}

export function normalizeCariTransaction(row = {}) {
  const { debit, credit } = pickDebitCredit(row);
  const operationDate = tsToDate(row.operationDate) || tsToDate(row.createdAt);

  return {
    ...row,
    operationType: (row.operationType || row.source || "").toString().trim() || null,
    direction: (row.direction || row.type || "").toString().trim().toLowerCase() || null,
    documentNo: (row.documentNo || row.invoiceNo || row.receiptNo || "").toString().trim() || null,
    refId: (row.refId || "").toString().trim() || null,
    note: (row.note || row.description || "").toString().trim(),
    debit: round2(debit),
    credit: round2(credit),
    amount: round2(debit || credit || row.amount),
    operationDate,
  };
}

export function buildRunningBalanceRows(rows = []) {
  let balance = 0;

  return rows.map((row) => {
    const tx = normalizeCariTransaction(row);
    balance = round2(balance + tx.debit - tx.credit);
    return {
      ...tx,
      balance,
    };
  });
}

export function summarizeCariTransactions(rows = []) {
  const normalized = rows.map(normalizeCariTransaction);

  const summary = normalized.reduce(
    (acc, tx) => {
      acc.debit += tx.debit;
      acc.credit += tx.credit;
      acc.balance += tx.debit - tx.credit;

      const opDate = tx.operationDate;
      if (opDate && (!acc.lastMovementDate || opDate > acc.lastMovementDate)) {
        acc.lastMovementDate = opDate;
      }

      return acc;
    },
    {
      debit: 0,
      credit: 0,
      balance: 0,
      lastMovementDate: null,
      count: normalized.length,
    }
  );

  return {
    debit: round2(summary.debit),
    credit: round2(summary.credit),
    balance: round2(summary.balance),
    lastMovementDate: summary.lastMovementDate,
    count: summary.count,
  };
}

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

export async function listAllCariTransactions() {
  const snap = await getDocs(collection(db, "cari_transactions"));

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function summarizeAllCariBalances() {
  const rows = await listAllCariTransactions();
  const map = {};

  for (const row of rows) {
    const tx = normalizeCariTransaction(row);
    if (!tx.cariId) continue;

    if (!map[tx.cariId]) {
      map[tx.cariId] = {
        cariId: tx.cariId,
        debit: 0,
        credit: 0,
        balance: 0,
        lastMovementDate: null,
        count: 0,
      };
    }

    map[tx.cariId].debit = round2(map[tx.cariId].debit + tx.debit);
    map[tx.cariId].credit = round2(map[tx.cariId].credit + tx.credit);
    map[tx.cariId].balance = round2(map[tx.cariId].balance + tx.debit - tx.credit);
    map[tx.cariId].count += 1;

    if (
      tx.operationDate &&
      (!map[tx.cariId].lastMovementDate || tx.operationDate > map[tx.cariId].lastMovementDate)
    ) {
      map[tx.cariId].lastMovementDate = tx.operationDate;
    }
  }

  return map;
}
