// app/satissitok/services/invoiceCounterService.js
import { doc } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Central, year-aware invoice & draft counter service.
 *
 * Firestore schema:
 *
 * invoice_counters/{kind}
 * {
 *   years: {
 *     "26": { official: 123, actual: 45 },
 *     "27": { official: 1, actual: 0 }
 *   },
 *   updatedAt: serverTimestamp() // optional (set by callers if needed)
 * }
 *
 * draft_counters/{kind}
 * {
 *   years: {
 *     "26": { seq: 14 },
 *     "27": { seq: 3 }
 *   },
 *   updatedAt: serverTimestamp() // optional (set by callers if needed)
 * }
 *
 * kind: "purchases" | "sales"
 * type: "official" | "actual"
 */

function pad6(n) {
  return String(Number(n) || 0).padStart(6, "0");
}

function normalizeKind(kind) {
  const k = String(kind || "").trim();
  if (k !== "purchases" && k !== "sales") {
    throw new Error("kind geçersiz: purchases | sales olmalı");
  }
  return k;
}

function normalizeType(type) {
  const t = String(type || "").trim();
  if (t !== "official" && t !== "actual") {
    throw new Error("type geçersiz: official | actual olmalı");
  }
  return t;
}

export function year2FromDateISO(dateISO) {
  if (!dateISO) return String(new Date().getFullYear()).slice(-2);
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime())
    ? String(new Date().getFullYear()).slice(-2)
    : String(d.getFullYear()).slice(-2);
}

export function getInvoicePrefix(kind, type) {
  const k = normalizeKind(kind);
  const t = normalizeType(type);

  if (k === "purchases") {
    return t === "official" ? "PR" : "PF";
  }

  return t === "official" ? "SR" : "SF";
}

export function getDraftPrefix(kind) {
  const k = normalizeKind(kind);
  return k === "purchases" ? "PD" : "SD";
}

export function formatInvoiceNo({ kind, type, yy, seq }) {
  const prefix = getInvoicePrefix(kind, type);
  return `${prefix}-${yy}-${pad6(seq)}`;
}

export function formatDraftNo({ kind, yy, seq }) {
  const prefix = getDraftPrefix(kind);
  return `${prefix}-${yy}-${pad6(seq)}`;
}

/**
 * Reserves next sequence number inside a transaction.
 * - Creates invoice_counters/{kind} if missing.
 * - Keeps counters per year (yy).
 *
 * Returns: { yy, nextSeq, autoInvoice, counterRefPath }
 */
export async function reserveNextInvoiceNo({
  transaction,
  kind,
  type,
  dateISO,
}) {
  const k = normalizeKind(kind);
  const t = normalizeType(type);

  const yy = year2FromDateISO(dateISO);
  const counterRef = doc(db, "invoice_counters", k);
  const snap = await transaction.get(counterRef);

  const data = snap.exists() ? snap.data() : {};
  const years = (data && typeof data === "object" ? data.years : null) || {};
  const yearMap = (years && typeof years === "object" ? years[yy] : null) || {};
  const currentSeq = Number(yearMap[t] || 0);
  const nextSeq = currentSeq + 1;

  // Merge back: years.yy.type = nextSeq
  transaction.set(
    counterRef,
    {
      years: {
        [yy]: {
          ...yearMap,
          [t]: nextSeq,
        },
      },
    },
    { merge: true }
  );

  const autoInvoice = formatInvoiceNo({
    kind: k,
    type: t,
    yy,
    seq: nextSeq,
  });

  return {
    yy,
    nextSeq,
    autoInvoice,
    counterRefPath: `invoice_counters/${k}`,
  };
}

/**
 * Reserves next draft sequence number inside a transaction.
 * - Creates draft_counters/{kind} if missing.
 * - Keeps counters per year (yy).
 *
 * Returns: { yy, nextSeq, autoDraftNo, counterRefPath }
 */
export async function reserveNextDraftNo({
  transaction,
  kind,
  dateISO,
}) {
  const k = normalizeKind(kind);
  const yy = year2FromDateISO(dateISO);

  const counterRef = doc(db, "draft_counters", k);
  const snap = await transaction.get(counterRef);

  const data = snap.exists() ? snap.data() : {};
  const years = (data && typeof data === "object" ? data.years : null) || {};
  const yearMap = (years && typeof years === "object" ? years[yy] : null) || {};
  const currentSeq = Number(yearMap.seq || 0);
  const nextSeq = currentSeq + 1;

  transaction.set(
    counterRef,
    {
      years: {
        [yy]: {
          ...yearMap,
          seq: nextSeq,
        },
      },
    },
    { merge: true }
  );

  const autoDraftNo = formatDraftNo({
    kind: k,
    yy,
    seq: nextSeq,
  });

  return {
    yy,
    nextSeq,
    autoDraftNo,
    counterRefPath: `draft_counters/${k}`,
  };
}