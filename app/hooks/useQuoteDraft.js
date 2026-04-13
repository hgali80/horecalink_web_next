"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getQuoteDraft } from "../services/quoteDraftService";

function subscribeToQuoteDraft(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => callback();

  window.addEventListener("quote-draft-updated", handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener("quote-draft-updated", handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") {
    return "[]";
  }

  try {
    return window.localStorage.getItem("horecalink_quote_draft") || "[]";
  } catch {
    return "[]";
  }
}

export function useQuoteDraft() {
  const snapshot = useSyncExternalStore(subscribeToQuoteDraft, getSnapshot, () => "[]");
  const items = useMemo(() => {
    try {
      const parsed = JSON.parse(snapshot);
      return Array.isArray(parsed) ? parsed : getQuoteDraft();
    } catch {
      return getQuoteDraft();
    }
  }, [snapshot]);

  return useMemo(() => {
    const totalQuantity = items.reduce(
      (sum, item) => sum + (Number(item?.quantity) || 0),
      0
    );

    return {
      items,
      itemKinds: items.length,
      totalQuantity,
    };
  }, [items]);
}
