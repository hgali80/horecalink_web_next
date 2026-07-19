import { NextResponse } from "next/server";
import { addDoc, collection } from "firebase/firestore";

import { db } from "@/firebase/index";
import { getAdminServices } from "@/app/lib/server/firebaseAdmin";

export const runtime = "nodejs";

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

function getPageMetadata(pathname) {
  const productMatch = pathname.match(/^\/products\/([^/?#]+)/);

  if (productMatch) {
    return {
      pageType: "product",
      productSlug: decodeURIComponent(productMatch[1]).slice(0, 200),
    };
  }

  return {
    pageType: "page",
    productSlug: null,
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const visitorId = limitText(body?.visitorId, 160);
    const sessionId = limitText(body?.sessionId, 160);
    const pathname = limitText(body?.pathname, 500);
    const referrer = limitText(body?.referrer, 1000);
    const isSessionStart = body?.isSessionStart === true;

    if (!visitorId || !sessionId || !pathname.startsWith("/") || shouldSkipPath(pathname)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const userAgent = limitText(request.headers.get("user-agent"), 500);
    const country = getVisitorCountry(request);
    const visitedAt = new Date();
    const basePayload = {
      visitorId,
      sessionId,
      pathname,
      referrer,
      userAgent,
      country,
      visitedAt,
    };
    const pageViewPayload = {
      ...basePayload,
      ...getPageMetadata(pathname),
    };

    try {
      const { adminDb } = getAdminServices();
      const batch = adminDb.batch();
      batch.set(adminDb.collection("page_view_logs").doc(), pageViewPayload);
      if (isSessionStart) {
        batch.set(adminDb.collection("visit_logs").doc(), basePayload);
      }
      await batch.commit();
    } catch {
      const writes = [addDoc(collection(db, "page_view_logs"), pageViewPayload)];
      if (isSessionStart) {
        writes.push(addDoc(collection(db, "visit_logs"), basePayload));
      }
      await Promise.all(writes);
    }

    return NextResponse.json({ ok: true });
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
