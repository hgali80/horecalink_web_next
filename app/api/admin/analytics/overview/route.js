import { NextResponse } from "next/server";

import {
  STAFF_ROLES,
  authorizeAdminRequest,
} from "@/app/lib/server/firebaseAdmin";
import {
  buildAnalyticsOverview,
  getAnalyticsRange,
} from "@/app/lib/analytics/analyticsOverview";

export const runtime = "nodejs";

const MAX_PAGE_VIEW_ROWS = 5000;
const MAX_VISITOR_ROWS = 100;

function cleanText(value) {
  return String(value || "").trim();
}

function getProductName(data = {}) {
  return cleanText(data.name) || cleanText(data.name_tr) || cleanText(data.name_ru) || "Ürün";
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
    const url = new URL(request.url);
    const rangeKey = url.searchParams.get("range") || "30d";
    const includeDetails = url.searchParams.get("details") !== "0";
    const now = new Date();
    const range = getAnalyticsRange(rangeKey, now);

    const [visitSnapshot, pageViewSnapshot] = await Promise.all([
      adminDb
        .collection("visit_logs")
        .where("visitedAt", ">=", range.start)
        .where("visitedAt", "<=", range.end)
        .get(),
      adminDb
        .collection("page_view_logs")
        .where("visitedAt", ">=", range.start)
        .where("visitedAt", "<=", range.end)
        .orderBy("visitedAt", "desc")
        .limit(MAX_PAGE_VIEW_ROWS)
        .get(),
    ]);

    const visitRows = visitSnapshot.docs.map((doc) => doc.data() || {});
    const pageViewRows = pageViewSnapshot.docs.map((doc) => doc.data() || {});
    const productNames = await resolveProductNames(adminDb, pageViewRows);
    const overview = buildAnalyticsOverview({
      visitRows,
      pageViewRows,
      productNames,
      rangeKey: range.key,
      now,
      maxVisitors: includeDetails ? MAX_VISITOR_ROWS : 0,
    });

    if (!includeDetails) {
      overview.visitorDetails = [];
    }

    return NextResponse.json({
      ok: true,
      generatedAt: now.toISOString(),
      ...overview,
      detailRowsLimited: pageViewSnapshot.size >= MAX_PAGE_VIEW_ROWS,
      visitorRowsLimited: overview.visitorDetails.length >= MAX_VISITOR_ROWS,
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
