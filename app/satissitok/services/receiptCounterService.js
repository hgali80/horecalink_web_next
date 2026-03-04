// app/satissitok/services/receiptCounterService.js
import { doc } from "firebase/firestore";
import { db } from "@/firebase";

function pad6(n) {
  return String(Number(n) || 0).padStart(6, "0");
}

function year2FromDateISO(dateISO) {
  if (!dateISO) return String(new Date().getFullYear()).slice(-2);
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime())
    ? String(new Date().getFullYear()).slice(-2)
    : String(d.getFullYear()).slice(-2);
}

// RC-26-000001 / RP-26-000001
export function formatReceiptNo({ kind, yy, seq }) {
  const k = String(kind || "").trim();
  const prefix = k === "collect" ? "RC" : "RP";
  return `${prefix}-${yy}-${pad6(seq)}`;
}

/**
 * kind: collect | pay
 * Firestore:
 * receipt_counters/{kind}
 * { years: { "26": { seq: 12 } } }
 */
export async function reserveNextReceiptNo({ transaction, kind, dateISO }) {
  const k = String(kind || "").trim();
  if (k !== "collect" && k !== "pay") {
    throw new Error("receipt kind geçersiz: collect | pay olmalı");
  }

  const yy = year2FromDateISO(dateISO);
  const counterRef = doc(db, "receipt_counters", k);
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
        [yy]: { ...yearMap, seq: nextSeq },
      },
    },
    { merge: true }
  );

  const receiptNo = formatReceiptNo({ kind: k, yy, seq: nextSeq });
  return { yy, nextSeq, receiptNo, counterRefPath: `receipt_counters/${k}` };
}
