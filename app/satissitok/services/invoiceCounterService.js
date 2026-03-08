// app/satissitok/services/invoiceCounterService.js
import { doc } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Central, year-aware invoice counter service.
 *
 * Firestore schema:
 * invoice_counters/{kind}
 * {
 *   years: {
 *     "26": { official: 123, actual: 45 },
 *     "27": { official: 1, actual: 0 }
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

export function year2FromDateISO(dateISO) {
  if (!dateISO) return String(new Date().getFullYear()).slice(-2);
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime())
    ? String(new Date().getFullYear()).slice(-2)
    : String(d.getFullYear()).slice(-2);
}

export function formatInvoiceNo({ kind, type, yy, seq }) {
  const k = String(kind || "").trim();
  const t = String(type || "").trim();

  // Standardized prefixes
  const prefix =
    k === "purchases"
      ? t === "official"
        ? "PR"
        : "PF"
      : // sales
      t === "official"
      ? "SR"
      : "SF";

  return `${prefix}-${yy}-${pad6(seq)}`;
}

/**
 * Reserves next sequence number inside a transaction.
 * - Creates invoice_counters/{kind} if missing.
 * - Keeps counters per year (yy).
 *
 * Returns: { nextSeq, autoInvoice }
 */
export async function reserveNextInvoiceNo({
  transaction,
  kind,
  type,
  dateISO,
}) {
  const k = String(kind || "").trim();
  if (k !== "purchases" && k !== "sales") {
    throw new Error("kind geçersiz: purchases | sales olmalı");
  }

  const t = String(type || "").trim();
  if (t !== "official" && t !== "actual") {
    throw new Error("type geçersiz: official | actual olmalı");
  }

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

  const autoInvoice = formatInvoiceNo({ kind: k, type: t, yy, seq: nextSeq });
  return { yy, nextSeq, autoInvoice, counterRefPath: `invoice_counters/${k}` };
}
