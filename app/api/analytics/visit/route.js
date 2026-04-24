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

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const visitorId = String(body?.visitorId || "").trim();
    const sessionId = String(body?.sessionId || "").trim();
    const pathname = String(body?.pathname || "").trim();
    const referrer = String(body?.referrer || "").trim();

    if (!visitorId || !sessionId || shouldSkipPath(pathname)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const userAgent = request.headers.get("user-agent") || "";
    const country = getVisitorCountry(request);
    const payload = {
      visitorId,
      sessionId,
      pathname,
      referrer,
      userAgent,
      country,
      visitedAt: new Date(),
    };

    try {
      const { adminDb } = getAdminServices();
      await adminDb.collection("visit_logs").add(payload);
    } catch {
      await addDoc(collection(db, "visit_logs"), payload);
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
