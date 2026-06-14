"use client";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { ERP_COLLECTIONS } from "./erpCollections";

function text(value) {
  return String(value ?? "").trim();
}

function pad4(value) {
  return String(Number(value) || 0).padStart(4, "0");
}

function getYear2(dateISO) {
  const date = dateISO ? new Date(dateISO) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return String(year).slice(-2);
}

export function buildCounterDocId({ kind, docType, counterType, yy }) {
  return `${kind}_${docType}_${counterType}_${yy}`;
}

export function getNumberPrefix(settings, kind, docType, counterType) {
  const normalizedKind = kind === "purchases" ? "purchases" : "sales";
  const normalizedType = docType === "F" ? "F" : "R";
  const key =
    counterType === "draft"
      ? "draftPrefix"
      : counterType === "document"
        ? "documentPrefix"
        : "invoicePrefix";

  return (
    text(settings?.numbering?.[normalizedKind]?.[normalizedType]?.[key]) ||
    text(settings?.numbering?.sales?.R?.draftPrefix)
  );
}

export function formatCounterNumber({ prefix, yy, seq }) {
  return `${text(prefix)}-${yy}-${pad4(seq)}`;
}

export async function getCounterPreview({ settings, kind, docType, counterType, dateISO }) {
  const yy = getYear2(dateISO);
  const collectionName =
    counterType === "draft" ? ERP_COLLECTIONS.DRAFT_COUNTERS : ERP_COLLECTIONS.INVOICE_COUNTERS;
  const counterId = buildCounterDocId({ kind, docType, counterType, yy });
  const snap = await getDoc(doc(db, collectionName, counterId));
  const current = snap.exists() ? Number(snap.data()?.lastSeq || 0) : 0;
  const nextSeq = current + 1;

  return {
    yy,
    nextSeq,
    counterId,
    number: formatCounterNumber({
      prefix: getNumberPrefix(settings, kind, docType, counterType),
      yy,
      seq: nextSeq,
    }),
  };
}
