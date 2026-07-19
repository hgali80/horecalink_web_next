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
import { buildVisitorDetails } from "@/app/lib/analytics/visitorDetails";

export const runtime = "nodejs";

const DETAIL_LOOKBACK_DAYS = 30;
const MAX_PAGE_VIEW_ROWS = 1000;

function cleanText(value) {
  return String(value || "").trim();
}

function getProductName(data = {}) {
  return cleanText(data.name) || cleanText(data.name_tr) || cleanText(data.name_ru) || "Urun";
}

async function resolveProductNames(adminDb, pageViewRows) {
  const slugs = Array.from(
    new Set(pageViewRows.map((item) => cleanText(item?.productSlug)).filter(Boolean))
  );
  const names = {};

  for (let index = 0; index < slugs.length; index += 30) {
    const chunk = slugs.slice(index, index + 30);
    const snapshot = await adminDb.collection("products").where("slug", "in", chunk).get();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const slug = cleanText(data.slug);
      if (slug) names[slug] = getProductName(data);
    });
  }

  const missingSlugs = slugs.filter((slug) => !names[slug]);
  if (missingSlugs.length) {
    const snapshots = await adminDb.getAll(
      ...missingSlugs.map((slug) => adminDb.collection("products").doc(slug))
    );
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) names[snapshot.id] = getProductName(snapshot.data() || {});
    });
  }

  return names;
}

export async function GET(request) {
  try {
    const authResult = await authorizeAdminRequest(request, STAFF_ROLES);

    if (!authResult.ok) {
      return authResult.response;
    }

    const { adminDb } = authResult;
    const ranges = getRangeStarts();
    const detailStart = new Date(
      ranges.now.getTime() - DETAIL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    );
    const [snapshot, pageViewSnapshot] = await Promise.all([
      adminDb
        .collection("visit_logs")
        .where("visitedAt", ">=", ranges.startOfYear)
        .where("visitedAt", "<=", ranges.now)
        .get(),
      adminDb
        .collection("page_view_logs")
        .where("visitedAt", ">=", detailStart)
        .orderBy("visitedAt", "desc")
        .limit(MAX_PAGE_VIEW_ROWS)
        .get(),
    ]);

    const responsePeriods = buildVisitorPeriods(
      snapshot.docs.map((doc) => doc.data() || {}),
      ranges
    );
    const pageViewRows = pageViewSnapshot.docs.map((doc) => doc.data() || {});
    const productNames = await resolveProductNames(adminDb, pageViewRows);
    const visitorDetails = buildVisitorDetails(pageViewRows, productNames);

    return NextResponse.json({
      ok: true,
      timezone: DASHBOARD_TIMEZONE,
      generatedAt: ranges.now.toISOString(),
      periods: responsePeriods,
      visitorDetails,
      detailPeriodDays: DETAIL_LOOKBACK_DAYS,
      detailRowsLimited: pageViewSnapshot.size >= MAX_PAGE_VIEW_ROWS,
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
