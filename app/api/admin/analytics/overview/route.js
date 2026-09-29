import { NextResponse } from "next/server";

import {
  STAFF_ROLES,
  authorizeAdminRequest,
} from "@/app/lib/server/firebaseAdmin";
import { getCachedAdminAnalyticsOverview } from "@/app/lib/server/adminAnalyticsCache";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const authResult = await authorizeAdminRequest(request, STAFF_ROLES);

    if (!authResult.ok) {
      return authResult.response;
    }

    const url = new URL(request.url);
    const rangeKey = url.searchParams.get("range") || "30d";
    const includeDetails = url.searchParams.get("details") !== "0";
    const overview = await getCachedAdminAnalyticsOverview(rangeKey, includeDetails);

    return NextResponse.json({
      ok: true,
      ...overview,
    });
  } catch (error) {
    console.error("Visit analytics overview error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Ziyaretçi istatistikleri alınamadı.",
      },
      { status: 500 }
    );
  }
}
