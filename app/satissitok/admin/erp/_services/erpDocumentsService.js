"use client";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

function text(value) {
  return String(value ?? "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeErpDocumentStatus(status) {
  const value = text(status).toLowerCase();
  if (value === "confirmed" || value === "completed") return "confirmed";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  return "draft";
}

export function formatErpDate(value) {
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

export async function listErpDocuments(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  const rows = snap.docs.map((item) => {
    const data = item.data() || {};
    const totals = data?.totals || {};
    return {
      id: item.id,
      ...data,
      docType: text(data.docType || "R").toUpperCase() === "F" ? "F" : "R",
      status: normalizeErpDocumentStatus(data.status),
      draftNo: text(data.draftNo),
      documentNo: text(data.documentNo),
      invoiceNo: text(data.invoiceNo),
      cariName: text(
        data.cariName ||
          data.customerName ||
          data.supplierName ||
          data?.cariSnapshot?.name ||
          data?.cariSnapshot?.companyName
      ),
      totalAmount: num(
        data.totalAmount ??
          data.grossTotal ??
          totals.gross ??
          totals.total ??
          totals.grandTotal,
        0
      ),
      paymentStatus: text(data?.settlementSummary?.status || data?.paymentStatus || "open") || "open",
      dateLabel: formatErpDate(data.documentDate || data.invoiceDate || data.createdAt),
      sortTime: resolveSortTime(data.documentDate || data.invoiceDate || data.createdAt),
    };
  });

  rows.sort((a, b) => b.sortTime - a.sortTime);
  return rows;
}

export async function getErpDocument(collectionName, documentId) {
  const ref = doc(db, collectionName, documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("ERP belgesi bulunamadi.");
  }

  const data = snap.data() || {};
  const totals = data?.totals || {};
  return {
    id: snap.id,
    ...data,
    docType: text(data.docType || "R").toUpperCase() === "F" ? "F" : "R",
    status: normalizeErpDocumentStatus(data.status),
    draftNo: text(data.draftNo),
    documentNo: text(data.documentNo),
    invoiceNo: text(data.invoiceNo),
    cariName: text(
      data.cariName ||
        data.customerName ||
        data.supplierName ||
        data?.cariSnapshot?.name ||
        data?.cariSnapshot?.companyName
    ),
    totalAmount: num(
      data.totalAmount ??
        data.grossTotal ??
        totals.gross ??
        totals.total ??
        totals.grandTotal,
      0
    ),
    paymentStatus: text(data?.settlementSummary?.status || data?.paymentStatus || "open") || "open",
    dateLabel: formatErpDate(data.documentDate || data.invoiceDate || data.createdAt),
    sortTime: resolveSortTime(data.documentDate || data.invoiceDate || data.createdAt),
  };
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
