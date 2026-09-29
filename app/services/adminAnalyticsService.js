import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "../../firebase/index";
import {
  buildAnalyticsOverview,
  getAnalyticsRange,
} from "../lib/analytics/analyticsOverview";

const MAX_PAGE_VIEW_ROWS = 5000;
const VISITOR_DETAILS_DAYS = 2;

function cleanText(value) {
  return String(value || "").trim();
}

function buildSummaryFromVisits(visitRows, pageViewCount, range, now) {
  const visitorIds = new Set();
  const kazakhstanVisitorIds = new Set();

  visitRows.forEach((row) => {
    const visitorId = cleanText(row?.visitorId);
    if (!visitorId) return;

    visitorIds.add(visitorId);
    if (cleanText(row?.country).toUpperCase() === "KZ") {
      kazakhstanVisitorIds.add(visitorId);
    }
  });

  const uniqueVisitors = visitorIds.size;
  const kazakhstanVisitors = kazakhstanVisitorIds.size;

  return {
    ok: true,
    generatedAt: now.toISOString(),
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

async function loadFromFirestore(rangeKey, includeDetails) {
  const now = new Date();
  const range = getAnalyticsRange(rangeKey, now);
  const visitorDetailsStart = new Date(now);
  visitorDetailsStart.setDate(visitorDetailsStart.getDate() - VISITOR_DETAILS_DAYS);
  const visitQuery = query(
    collection(db, "visit_logs"),
    where("visitedAt", ">=", range.start),
    where("visitedAt", "<=", range.end)
  );
  const pageViewQuery = query(
    collection(db, "page_view_logs"),
    where("visitedAt", ">=", range.start),
    where("visitedAt", "<=", range.end)
  );

  if (!includeDetails) {
    const [visitSnapshot, pageViewCountSnapshot] = await Promise.all([
      getDocs(visitQuery),
      getCountFromServer(pageViewQuery),
    ]);

    return buildSummaryFromVisits(
      visitSnapshot.docs.map((document) => document.data() || {}),
      pageViewCountSnapshot.data().count,
      range,
      now
    );
  }

  const [visitSnapshot, pageViewSnapshot] = await Promise.all([
    getDocs(visitQuery),
    getDocs(query(pageViewQuery, orderBy("visitedAt", "desc"), limit(MAX_PAGE_VIEW_ROWS))),
  ]);

  const overview = buildAnalyticsOverview({
    visitRows: visitSnapshot.docs.map((doc) => doc.data() || {}),
    pageViewRows: pageViewSnapshot.docs.map((doc) => doc.data() || {}),
    rangeKey,
    now,
    maxVisitors: includeDetails ? 100 : 0,
    visitorDetailsStart,
  });

  return {
    ok: true,
    generatedAt: now.toISOString(),
    ...overview,
    detailRowsLimited: pageViewSnapshot.size >= MAX_PAGE_VIEW_ROWS,
    visitorRowsLimited: overview.visitorDetails.length >= 100,
  };
}

export async function loadAdminAnalytics({
  idToken,
  rangeKey = "30d",
  includeDetails = true,
}) {
  const params = new URLSearchParams({
    range: rangeKey,
    details: includeDetails ? "1" : "0",
  });
  const response = await fetch(`/api/admin/analytics/overview?${params}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (response.ok && data?.ok === true) {
    return data;
  }

  if (String(data?.error || "").includes("Firebase Admin env degiskenleri eksik")) {
    return loadFromFirestore(rangeKey, includeDetails);
  }

  throw new Error(data?.error || "Ziyaretçi istatistikleri alınamadı.");
}
