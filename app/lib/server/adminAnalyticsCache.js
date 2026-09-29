import "server-only";

import { unstable_cache } from "next/cache";

import {
  buildAnalyticsOverview,
  getAnalyticsRange,
} from "@/app/lib/analytics/analyticsOverview";
import { getAdminServices } from "@/app/lib/server/firebaseAdmin";

const MAX_PAGE_VIEW_ROWS = 5000;
const MAX_VISITOR_ROWS = 100;
const VISITOR_DETAILS_DAYS = 2;

function cleanText(value) {
  return String(value || "").trim();
}

function getProductName(data = {}) {
  return cleanText(data.name) || cleanText(data.name_tr) || cleanText(data.name_ru) || "Ürün";
}

function buildSummary(visitRows, pageViewCount, range) {
  const visitorIds = new Set();
  const kazakhstanVisitorIds = new Set();

  for (const row of visitRows) {
    const visitorId = cleanText(row?.visitorId);
    if (!visitorId) continue;

    visitorIds.add(visitorId);
    if (cleanText(row?.country).toUpperCase() === "KZ") {
      kazakhstanVisitorIds.add(visitorId);
    }
  }

  const uniqueVisitors = visitorIds.size;
  const kazakhstanVisitors = kazakhstanVisitorIds.size;

  return {
    range: {
      key: range.key,
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    summary: {
      uniqueVisitors,
      pageViews: pageViewCount,
      sessions: visitRows.length,
      uniquePages: 0,
      kazakhstanVisitors,
      otherVisitors: Math.max(uniqueVisitors - kazakhstanVisitors, 0),
      kazakhstanRatio: uniqueVisitors
        ? Math.round((kazakhstanVisitors / uniqueVisitors) * 100)
        : 0,
    },
    trend: [],
    topPages: [],
    topProducts: [],
    countries: [],
    visitorDetails: [],
    detailRowsLimited: false,
    visitorRowsLimited: false,
    summaryOnly: true,
  };
}

async function resolveProductNames(adminDb, pageViewRows) {
  const slugs = Array.from(
    new Set(pageViewRows.map((item) => cleanText(item?.productSlug)).filter(Boolean))
  );
  const names = {};

  for (let index = 0; index < slugs.length; index += 30) {
    const chunk = slugs.slice(index, index + 30);
    const snapshot = await adminDb
      .collection("products")
      .where("slug", "in", chunk)
      .select("slug", "name", "name_tr", "name_ru")
      .get();

    snapshot.docs.forEach((document) => {
      const data = document.data() || {};
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

async function loadSummary(adminDb, range) {
  const visitQuery = adminDb
    .collection("visit_logs")
    .where("visitedAt", ">=", range.start)
    .where("visitedAt", "<=", range.end);
  const pageViewQuery = adminDb
    .collection("page_view_logs")
    .where("visitedAt", ">=", range.start)
    .where("visitedAt", "<=", range.end);

  const [visitSnapshot, pageViewCountSnapshot] = await Promise.all([
    visitQuery.select("visitorId", "country").get(),
    pageViewQuery.count().get(),
  ]);

  return buildSummary(
    visitSnapshot.docs.map((document) => document.data() || {}),
    pageViewCountSnapshot.data().count,
    range
  );
}

async function loadDetailedOverview(adminDb, range, now) {
  const visitorDetailsStart = new Date(now);
  visitorDetailsStart.setDate(visitorDetailsStart.getDate() - VISITOR_DETAILS_DAYS);

  const [visitSnapshot, pageViewSnapshot] = await Promise.all([
    adminDb
      .collection("visit_logs")
      .where("visitedAt", ">=", range.start)
      .where("visitedAt", "<=", range.end)
      .select("visitorId", "country", "visitedAt")
      .get(),
    adminDb
      .collection("page_view_logs")
      .where("visitedAt", ">=", range.start)
      .where("visitedAt", "<=", range.end)
      .orderBy("visitedAt", "desc")
      .limit(MAX_PAGE_VIEW_ROWS)
      .select(
        "visitorId",
        "sessionId",
        "pathname",
        "pageType",
        "productSlug",
        "country",
        "referrer",
        "userAgent",
        "visitedAt"
      )
      .get(),
  ]);

  const visitRows = visitSnapshot.docs.map((document) => document.data() || {});
  const pageViewRows = pageViewSnapshot.docs.map((document) => document.data() || {});
  const productNames = await resolveProductNames(adminDb, pageViewRows);
  const overview = buildAnalyticsOverview({
    visitRows,
    pageViewRows,
    productNames,
    rangeKey: range.key,
    now,
    maxVisitors: MAX_VISITOR_ROWS,
    visitorDetailsStart,
  });

  return {
    ...overview,
    detailRowsLimited: pageViewSnapshot.size >= MAX_PAGE_VIEW_ROWS,
    visitorRowsLimited: overview.visitorDetails.length >= MAX_VISITOR_ROWS,
    summaryOnly: false,
  };
}

const getCachedOverview = unstable_cache(
  async (rangeKey, includeDetails) => {
    const { adminDb } = getAdminServices();
    const now = new Date();
    const range = getAnalyticsRange(rangeKey, now);
    const overview = includeDetails
      ? await loadDetailedOverview(adminDb, range, now)
      : await loadSummary(adminDb, range);

    return {
      generatedAt: now.toISOString(),
      ...overview,
    };
  },
  ["admin-analytics-overview-v2"],
  { revalidate: 60 }
);

export function getCachedAdminAnalyticsOverview(rangeKey, includeDetails) {
  const safeRangeKey = getAnalyticsRange(rangeKey).key;
  return getCachedOverview(safeRangeKey, includeDetails === true);
}
