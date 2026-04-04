import { NextResponse } from "next/server";

import {
  STAFF_ROLES,
  authorizeAdminRequest,
} from "@/app/lib/server/firebaseAdmin";
import {
  buildVisitorPeriods,
  DASHBOARD_TIMEZONE,
  getRangeStarts,
} from "@/app/lib/analytics/visitorPeriods";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const authResult = await authorizeAdminRequest(request, STAFF_ROLES);

    if (!authResult.ok) {
      return authResult.response;
    }

    const { adminDb } = authResult;
    const ranges = getRangeStarts();
    const snapshot = await adminDb
      .collection("visit_logs")
      .where("visitedAt", ">=", ranges.startOfYear)
      .where("visitedAt", "<=", ranges.now)
      .get();

    const responsePeriods = buildVisitorPeriods(
      snapshot.docs.map((doc) => doc.data() || {}),
      ranges
    );

    return NextResponse.json({
      ok: true,
      timezone: DASHBOARD_TIMEZONE,
      generatedAt: ranges.now.toISOString(),
      periods: responsePeriods,
    });
  } catch (error) {
    console.error("Visit analytics overview error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Ziyaretci istatistikleri alinamadi.",
      },
      { status: 500 }
    );
  }
}
