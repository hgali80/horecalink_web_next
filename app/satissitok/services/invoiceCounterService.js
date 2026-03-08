// app/satissitok/services/invoiceCounterService.js
import { doc } from "firebase/firestore";
import { db } from "@/firebase";

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

  const prefix =
    k === "purchases"
      ? t === "official"
        ? "PR"
        : "PF"
      : t === "official"
      ? "SR"
      : "SF";

  return `${prefix}-${yy}-${pad6(seq)}`;
}

export function formatDraftNo({ kind, yy, seq }) {
  const k = String(kind || "").trim();
  const prefix = k === "purchases" ? "PD" : "SD";
  return `${prefix}-${yy}-${pad6(seq)}`;
}

export async function reserveNextInvoiceNo({ transaction, kind, type, dateISO }) {
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

export async function reserveNextDraftNo({ transaction, kind, dateISO }) {
  const k = String(kind || "").trim();
  if (k !== "purchases" && k !== "sales") {
    throw new Error("kind geçersiz: purchases | sales olmalı");
  }

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

  const draftNo = formatDraftNo({ kind: k, yy, seq: nextSeq });
  return { yy, nextSeq, draftNo, counterRefPath: `draft_counters/${k}` };
}
