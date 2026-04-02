"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "../context/AuthContext";

const VISITOR_ID_KEY = "horecalink_visitor_id";
const SESSION_ID_KEY = "horecalink_visit_session_id";
const SESSION_TRACKED_KEY = "horecalink_visit_logged";
const EXCLUDED_PATH_PREFIXES = ["/satissitok", "/login", "/api"];

function shouldSkipPath(pathname) {
  if (!pathname) {
    return true;
  }

  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateStorageValue(storage, key, prefix) {
  const currentValue = storage.getItem(key);

  if (currentValue) {
    return currentValue;
  }

  const nextValue = createId(prefix);
  storage.setItem(key, nextValue);
  return nextValue;
}

export default function VisitorTracker() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user || shouldSkipPath(pathname)) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (window.sessionStorage.getItem(SESSION_TRACKED_KEY) === "1") {
      return;
    }

    const visitorId = getOrCreateStorageValue(window.localStorage, VISITOR_ID_KEY, "visitor");
    const sessionId = getOrCreateStorageValue(window.sessionStorage, SESSION_ID_KEY, "session");

    window.sessionStorage.setItem(SESSION_TRACKED_KEY, "1");

    fetch("/api/analytics/visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        visitorId,
        sessionId,
        pathname,
        referrer: document.referrer || "",
      }),
      keepalive: true,
      cache: "no-store",
    }).catch(() => {
      window.sessionStorage.removeItem(SESSION_TRACKED_KEY);
    });
  }, [loading, pathname, user]);

  return null;
}
