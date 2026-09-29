"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "../context/AuthContext";

const VISITOR_ID_KEY = "horecalink_visitor_id";
const SESSION_ID_KEY = "horecalink_visit_session_id";
const SESSION_TRACKED_KEY = "horecalink_visit_logged";
const RECENT_PAGE_VIEWS_KEY = "horecalink_recent_page_views";
const DUPLICATE_VIEW_WINDOW_MS = 30 * 1000;
const FLUSH_DELAY_MS = 10 * 1000;
const RETRY_DELAY_MS = 30 * 1000;
const MAX_BATCH_EVENTS = 20;
const EXCLUDED_PATH_PREFIXES = ["/satissitok", "/login", "/api"];

let pendingEvents = [];
let flushTimer = null;

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

function rememberPageView(storage, pathname, now) {
  let recentViews = {};

  try {
    const storedViews = JSON.parse(storage.getItem(RECENT_PAGE_VIEWS_KEY) || "{}");
    recentViews = storedViews && typeof storedViews === "object" ? storedViews : {};
  } catch {
    recentViews = {};
  }

  const cutoff = now - DUPLICATE_VIEW_WINDOW_MS;
  const activeViews = Object.fromEntries(
    Object.entries(recentViews).filter(([, timestamp]) => Number(timestamp) >= cutoff)
  );

  if (Number(activeViews[pathname] || 0) >= cutoff) {
    return false;
  }

  activeViews[pathname] = now;
  storage.setItem(RECENT_PAGE_VIEWS_KEY, JSON.stringify(activeViews));
  return true;
}

function scheduleFlush(delay = FLUSH_DELAY_MS) {
  if (flushTimer) {
    return;
  }

  flushTimer = window.setTimeout(() => flushPendingEvents(), delay);
}

function restoreBatch(batch) {
  pendingEvents = [...batch, ...pendingEvents];
  scheduleFlush(RETRY_DELAY_MS);
}

function flushPendingEvents({ useBeacon = false } = {}) {
  if (flushTimer) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (!pendingEvents.length) {
    return;
  }

  const batch = pendingEvents.splice(0, MAX_BATCH_EVENTS);
  const body = JSON.stringify({ events: batch });

  if (useBeacon && typeof navigator.sendBeacon === "function") {
    const queued = navigator.sendBeacon(
      "/api/analytics/visit",
      new Blob([body], { type: "application/json" })
    );

    if (queued) {
      if (pendingEvents.length) {
        flushPendingEvents({ useBeacon: true });
      }
      return;
    }
  }

  fetch("/api/analytics/visit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Analytics HTTP ${response.status}`);
      }

      if (pendingEvents.length) {
        scheduleFlush();
      }
    })
    .catch(() => restoreBatch(batch));
}

function queueEvent(event) {
  pendingEvents.push(event);

  if (pendingEvents.length >= MAX_BATCH_EVENTS) {
    flushPendingEvents();
    return;
  }

  scheduleFlush();
}

export default function VisitorTracker() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    const flushBeforeLeave = () => flushPendingEvents({ useBeacon: true });

    window.addEventListener("pagehide", flushBeforeLeave);

    return () => {
      window.removeEventListener("pagehide", flushBeforeLeave);
      flushBeforeLeave();
    };
  }, []);

  useEffect(() => {
    if (loading || user || shouldSkipPath(pathname)) {
      return;
    }

    const now = Date.now();

    if (!rememberPageView(window.sessionStorage, pathname, now)) {
      return;
    }

    const visitorId = getOrCreateStorageValue(window.localStorage, VISITOR_ID_KEY, "visitor");
    const sessionId = getOrCreateStorageValue(window.sessionStorage, SESSION_ID_KEY, "session");
    const isSessionStart = window.sessionStorage.getItem(SESSION_TRACKED_KEY) !== "1";

    window.sessionStorage.setItem(SESSION_TRACKED_KEY, "1");

    queueEvent({
      eventId: createId("view"),
      visitorId,
      sessionId,
      isSessionStart,
      pathname,
      referrer: document.referrer || "",
      occurredAt: new Date(now).toISOString(),
    });
  }, [loading, pathname, user]);

  return null;
}
