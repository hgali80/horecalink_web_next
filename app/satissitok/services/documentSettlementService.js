import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function text(value) {
  return String(value || "").trim();
}

function tsToDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "completed") return "confirmed";
  if (value === "pending") return "draft";
  if (value === "returned") return "cancelled";
  return value || "draft";
}

function buildDocPath(kind, invoiceId) {
  return kind === "purchase"
    ? ["purchases", invoiceId]
    : ["sales", invoiceId];
}

export function buildInitialSettlementSummary({ invoiceAmount }) {
  const amount = round2(invoiceAmount);
  return {
    invoiceAmount: amount,
    settledAmount: 0,
    outstandingAmount: amount,
    status: amount > 0 ? "open" : "closed",
    lastSettlementAt: null,
  };
}

export function buildSettlementSummary({ invoiceAmount, settledAmount }) {
  const invoice = round2(invoiceAmount);
  const settled = round2(Math.min(num(settledAmount), invoice));
  const outstanding = round2(Math.max(invoice - settled, 0));
  return {
    invoiceAmount: invoice,
    settledAmount: settled,
    outstandingAmount: outstanding,
    status: outstanding <= 0 ? "closed" : settled > 0 ? "partial" : "open",
  };
}

export function initializeSettlementFields({ invoiceAmount }) {
  return {
    settlementSummary: buildInitialSettlementSummary({ invoiceAmount }),
  };
}

export function writeDocumentSettlement({
  transaction,
  kind,
  invoiceId,
  amount,
  operationDate,
  receiptNo,
  accountId,
  method,
  description,
  cashTxId,
}) {
  const [collectionName] = buildDocPath(kind, invoiceId);
  const invoiceRef = doc(db, collectionName, invoiceId);
  return transaction.get(invoiceRef).then((snap) => {
    if (!snap.exists()) {
      throw new Error("Belge bulunamadi");
    }

    const data = snap.data();
    const invoiceNo = text(data.invoiceNo || data.saleNo || data.documentNo);
    const invoiceAmount = round2(
      kind === "purchase"
        ? data.grossTotal ?? data.totals?.gross ?? 0
        : data.grossTotal ?? 0
    );
    const currentSettled = round2(data.settlementSummary?.settledAmount || 0);
    const nextSettled = round2(currentSettled + amount);

    if (nextSettled - invoiceAmount > 0.001) {
      throw new Error("Tahsilat/odeme acik belge tutarini asiyor");
    }

    const settlementRef = doc(collection(db, "document_settlements"));
    transaction.set(settlementRef, {
      kind,
      invoiceId,
      invoiceNo: invoiceNo || null,
      cariId: data.cariId || data.supplierCariId || null,
      amount: round2(amount),
      operationDate: operationDate ? new Date(operationDate) : new Date(),
      receiptNo: receiptNo || null,
      accountId: accountId || null,
      method: method || null,
      cashTxId: cashTxId || null,
      description: text(description) || null,
      createdAt: serverTimestamp(),
    });

    transaction.set(
      invoiceRef,
      {
        settlementSummary: {
          ...buildSettlementSummary({
            invoiceAmount,
            settledAmount: nextSettled,
          }),
          lastSettlementAt: serverTimestamp(),
        },
      },
      { merge: true }
    );

    return {
      invoiceNo,
      settlementId: settlementRef.id,
      summary: buildSettlementSummary({
        invoiceAmount,
        settledAmount: nextSettled,
      }),
    };
  });
}

export async function writeDocumentSettlements({
  transaction,
  kind,
  allocations,
  operationDate,
  receiptNo,
  accountId,
  method,
  description,
  cashTxId,
}) {
  const rows = Array.isArray(allocations)
    ? allocations
        .map((row) => ({
          invoiceId: text(row?.invoiceId),
          amount: round2(row?.amount),
          invoiceNo: text(row?.invoiceNo) || null,
        }))
        .filter((row) => row.invoiceId && row.amount > 0)
    : [];

  const results = [];

  for (const row of rows) {
    const result = await writeDocumentSettlement({
      transaction,
      kind,
      invoiceId: row.invoiceId,
      amount: row.amount,
      operationDate,
      receiptNo,
      accountId,
      method,
      description,
      cashTxId,
    });

    results.push({
      ...result,
      invoiceId: row.invoiceId,
      amount: row.amount,
      invoiceNo: result?.invoiceNo || row.invoiceNo || null,
    });
  }

  return results;
}

export async function listOpenDocumentsByCari({ kind, cariId }) {
  if (!cariId) return [];

  const collectionName = kind === "purchase" ? "purchases" : "sales";
  const cariField = kind === "purchase" ? "supplierCariId" : "cariId";
  const q = query(
    collection(db, collectionName),
    where(cariField, "==", cariId),
    orderBy("documentDate", "desc")
  );
  const snap = await getDocs(q);

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((docData) => {
      const status = String(docData.status || "").toLowerCase();
      return status === "confirmed" || status === "completed";
    })
    .map((docData) => {
      const invoiceAmount = round2(
        kind === "purchase"
          ? docData.grossTotal ?? docData.totals?.gross ?? 0
          : docData.grossTotal ?? 0
      );
      const summary =
        docData.settlementSummary ||
        buildInitialSettlementSummary({ invoiceAmount });
      return {
        id: docData.id,
        invoiceNo: docData.invoiceNo || docData.documentNo || docData.saleNo || "-",
        documentDate: docData.documentDate || docData.invoiceDate || null,
        invoiceAmount,
        settledAmount: round2(summary.settledAmount || 0),
        outstandingAmount: round2(summary.outstandingAmount ?? invoiceAmount),
        status: summary.status || "open",
      };
    })
    .filter((docData) => docData.outstandingAmount > 0);
}

export async function listDocumentSettlementsByCari({ cariId, fromDate, toDate }) {
  if (!cariId) return [];

  const constraints = [where("cariId", "==", cariId), orderBy("operationDate", "desc")];

  if (fromDate) {
    constraints.push(where("operationDate", ">=", new Date(fromDate)));
  }

  if (toDate) {
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);
    constraints.push(where("operationDate", "<=", endDate));
  }

  const snap = await getDocs(query(collection(db, "document_settlements"), ...constraints));

  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      amount: round2(data.amount || 0),
      operationDate: tsToDate(data.operationDate) || tsToDate(data.createdAt),
      createdAt: tsToDate(data.createdAt),
    };
  });
}

export async function listDocumentSettlementsByInvoice({ kind, invoiceId }) {
  if (!invoiceId) return [];

  const snap = await getDocs(
    query(collection(db, "document_settlements"), where("invoiceId", "==", invoiceId))
  );

  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        amount: round2(data.amount || 0),
        operationDate: tsToDate(data.operationDate) || tsToDate(data.createdAt),
        createdAt: tsToDate(data.createdAt),
      };
    })
    .filter((row) => !kind || row.kind === kind)
    .sort((a, b) => {
      const left = a.operationDate?.getTime?.() || 0;
      const right = b.operationDate?.getTime?.() || 0;
      return right - left;
    });
}

export async function listDocumentsByCari({ cariId }) {
  if (!cariId) return [];

  const [salesSnap, purchasesSnap] = await Promise.all([
    getDocs(query(collection(db, "sales"), where("cariId", "==", cariId), orderBy("documentDate", "desc"))),
    getDocs(
      query(
        collection(db, "purchases"),
        where("supplierCariId", "==", cariId),
        orderBy("documentDate", "desc")
      )
    ),
  ]);

  const salesRows = salesSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    kind: "sale",
    ...docSnap.data(),
  }));
  const purchaseRows = purchasesSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    kind: "purchase",
    ...docSnap.data(),
  }));

  return [...salesRows, ...purchaseRows]
    .filter((row) => normalizeStatus(row.status) === "confirmed")
    .map((row) => {
      const invoiceAmount = round2(
        row.kind === "purchase" ? row.grossTotal ?? row.totals?.gross ?? 0 : row.grossTotal ?? 0
      );
      const settlementSummary =
        row.settlementSummary || buildInitialSettlementSummary({ invoiceAmount });

      return {
        id: row.id,
        kind: row.kind,
        invoiceNo: row.invoiceNo || row.documentNo || row.saleNo || row.draftNo || "-",
        documentDate: tsToDate(row.documentDate) || tsToDate(row.invoiceDate) || tsToDate(row.createdAt),
        invoiceAmount,
        settledAmount: round2(settlementSummary.settledAmount || 0),
        outstandingAmount: round2(settlementSummary.outstandingAmount ?? invoiceAmount),
        status: settlementSummary.status || "open",
        lastSettlementAt: tsToDate(settlementSummary.lastSettlementAt),
      };
    })
    .sort((a, b) => {
      const left = a.documentDate?.getTime?.() || 0;
      const right = b.documentDate?.getTime?.() || 0;
      return right - left;
    });
}
