import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { collection, doc, writeBatch } from "firebase/firestore";

import { db } from "@/firebase/index";
import { getAdminServices } from "@/app/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const MAX_BATCH_EVENTS = 20;
const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_EVENT_AGE_MS = 60 * 60 * 1000;
const MAX_FUTURE_OFFSET_MS = 60 * 1000;
const MISSING_ADMIN_CONFIG_MESSAGE = "Firebase Admin env degiskenleri eksik.";
const EXCLUDED_PATH_PREFIXES = ["/satissitok", "/login", "/api"];

function shouldSkipPath(pathname) {
  if (!pathname || typeof pathname !== "string") {
    return true;
  }

  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function normalizeCountry(value) {
  const country = String(value || "").trim().toUpperCase();
  return country || null;
}

function getVisitorCountry(request) {
  return normalizeCountry(
    request.headers.get("x-vercel-ip-country") ||
      request.headers.get("cf-ipcountry") ||
      request.headers.get("x-country-code") ||
      request.headers.get("cloudfront-viewer-country")
  );
}

function limitText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getPageMetadata(pathname) {
  const productMatch = pathname.match(/^\/products\/([^/?#]+)/);

  if (productMatch) {
    return {
      pageType: "product",
      productSlug: safeDecodeURIComponent(productMatch[1]).slice(0, 200),
    };
  }

  return {
    pageType: "page",
    productSlug: null,
  };
}

function normalizeVisitedAt(value, receivedAt) {
  const timestamp = Date.parse(String(value || ""));
  const earliestAllowed = receivedAt.getTime() - MAX_EVENT_AGE_MS;
  const latestAllowed = receivedAt.getTime() + MAX_FUTURE_OFFSET_MS;

  if (!Number.isFinite(timestamp) || timestamp < earliestAllowed || timestamp > latestAllowed) {
    return receivedAt;
  }

  return new Date(timestamp);
}

function normalizeEvent(rawEvent, receivedAt) {
  const visitorId = limitText(rawEvent?.visitorId, 160);
  const sessionId = limitText(rawEvent?.sessionId, 160);
  const pathname = limitText(rawEvent?.pathname, 500);

  if (!visitorId || !sessionId || !pathname.startsWith("/") || shouldSkipPath(pathname)) {
    return null;
  }

  return {
    eventId: limitText(rawEvent?.eventId, 200) || `legacy_${randomUUID()}`,
    visitorId,
    sessionId,
    isSessionStart: rawEvent?.isSessionStart === true,
    pathname,
    referrer: limitText(rawEvent?.referrer, 1000),
    visitedAt: normalizeVisitedAt(rawEvent?.occurredAt, receivedAt),
  };
}

function createDocumentId(...parts) {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

function buildWrites(events, request) {
  const userAgent = limitText(request.headers.get("user-agent"), 500);
  const country = getVisitorCountry(request);
  const sessionIds = new Set();
  const pageViews = [];
  const visits = [];

  for (const event of events) {
    const basePayload = {
      visitorId: event.visitorId,
      sessionId: event.sessionId,
      pathname: event.pathname,
      referrer: event.referrer,
      userAgent,
      country,
      visitedAt: event.visitedAt,
    };

    pageViews.push({
      id: createDocumentId("page-view", event.visitorId, event.sessionId, event.eventId),
      payload: {
        ...basePayload,
        ...getPageMetadata(event.pathname),
      },
    });

    if (event.isSessionStart && !sessionIds.has(event.sessionId)) {
      sessionIds.add(event.sessionId);
      visits.push({
        id: createDocumentId("visit", event.visitorId, event.sessionId),
        payload: basePayload,
      });
    }
  }

  return { pageViews, visits };
}

async function commitWithAdmin(writes) {
  const { adminDb } = getAdminServices();
  const batch = adminDb.batch();

  for (const pageView of writes.pageViews) {
    batch.set(adminDb.collection("page_view_logs").doc(pageView.id), pageView.payload);
  }

  for (const visit of writes.visits) {
    batch.set(adminDb.collection("visit_logs").doc(visit.id), visit.payload);
  }

  await batch.commit();
}

async function commitWithClientSdk(writes) {
  const batch = writeBatch(db);

  for (const pageView of writes.pageViews) {
    batch.set(doc(collection(db, "page_view_logs")), pageView.payload);
  }

  for (const visit of writes.visits) {
    batch.set(doc(collection(db, "visit_logs")), visit.payload);
  }

  await batch.commit();
}

function isMissingAdminConfiguration(error) {
  return error?.message === MISSING_ADMIN_CONFIG_MESSAGE;
}

export async function POST(request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);

    if (declaredLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ ok: false, error: "Istek cok buyuk." }, { status: 413 });
    }

    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return NextResponse.json({ ok: false, error: "Istek cok buyuk." }, { status: 413 });
    }

    let body;

    try {
      body = JSON.parse(rawBody || "{}");
    } catch {
      return NextResponse.json({ ok: false, error: "Gecersiz JSON." }, { status: 400 });
    }

    const rawEvents = Array.isArray(body?.events) ? body.events : [body];

    if (rawEvents.length > MAX_BATCH_EVENTS) {
      return NextResponse.json(
        { ok: false, error: `En fazla ${MAX_BATCH_EVENTS} olay gonderilebilir.` },
        { status: 413 }
      );
    }

    const receivedAt = new Date();
    const events = rawEvents
      .map((event) => normalizeEvent(event, receivedAt))
      .filter(Boolean);

    if (!events.length) {
      return NextResponse.json({ ok: true, skipped: true, accepted: 0 });
    }

    const writes = buildWrites(events, request);

    try {
      await commitWithAdmin(writes);
    } catch (error) {
      if (!isMissingAdminConfiguration(error)) {
        throw error;
      }

      await commitWithClientSdk(writes);
    }

    return NextResponse.json({ ok: true, accepted: events.length });
  } catch (error) {
    console.error("Visit analytics log error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Visit log kaydi olusturulamadi.",
      },
      { status: 500 }
    );
  }
}
