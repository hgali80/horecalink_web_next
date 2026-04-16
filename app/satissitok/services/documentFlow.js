export function normalizeDocumentStatus(status, { fallback = "draft" } = {}) {
  const s = String(status || fallback).trim().toLowerCase();

  if (s === "draft") return "draft";
  if (s === "confirmed" || s === "completed") return "confirmed";
  if (s === "cancelled" || s === "canceled") return "cancelled";

  // legacy / transitional aliases
  if (s === "pending") return "draft";
  if (s === "returned") return "cancelled";

  return fallback;
}

export function isConfirmedStatus(status) {
  return normalizeDocumentStatus(status) === "confirmed";
}

export function isDraftStatus(status) {
  return normalizeDocumentStatus(status) === "draft";
}

export function isCancelledStatus(status) {
  return normalizeDocumentStatus(status) === "cancelled";
}
