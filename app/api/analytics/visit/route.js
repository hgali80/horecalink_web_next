import { NextResponse } from "next/server";

import { getAdminServices } from "@/app/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const EXCLUDED_PATH_PREFIXES = ["/satissitok", "/login", "/api"];

function shouldSkipPath(pathname) {
  if (!pathname || typeof pathname !== "string") {
    return true;
  }

  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

    const { adminDb } = getAdminServices();
    const userAgent = request.headers.get("user-agent") || "";

    await adminDb.collection("visit_logs").add({
      visitorId,
      sessionId,
      pathname,
      referrer,
      userAgent,
      visitedAt: new Date(),
    });

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
