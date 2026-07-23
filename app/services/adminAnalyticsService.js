import {
  collection,
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

async function loadFromFirestore(rangeKey, includeDetails) {
  const now = new Date();
  const range = getAnalyticsRange(rangeKey, now);
  const [visitSnapshot, pageViewSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, "visit_logs"),
        where("visitedAt", ">=", range.start),
        where("visitedAt", "<=", range.end)
      )
    ),
    getDocs(
      query(
        collection(db, "page_view_logs"),
        where("visitedAt", ">=", range.start),
        where("visitedAt", "<=", range.end),
        orderBy("visitedAt", "desc"),
        limit(MAX_PAGE_VIEW_ROWS)
      )
    ),
  ]);

  const overview = buildAnalyticsOverview({
    visitRows: visitSnapshot.docs.map((doc) => doc.data() || {}),
    pageViewRows: pageViewSnapshot.docs.map((doc) => doc.data() || {}),
    rangeKey,
    now,
    maxVisitors: includeDetails ? 100 : 0,
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
