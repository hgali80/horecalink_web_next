import { buildVisitorDetails, getPageLabel } from "./visitorDetails";
import {
  DASHBOARD_TIMEZONE,
  getRangeStarts,
  normalizeVisitDate,
} from "./visitorPeriods";

const DAY_MS = 24 * 60 * 60 * 1000;

export const ANALYTICS_RANGES = {
  today: { label: "Bugün", days: 1 },
  "7d": { label: "Son 7 gün", days: 7 },
  "30d": { label: "Son 30 gün", days: 30 },
  year: { label: "Bu yıl", days: null },
};

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeCountry(value) {
  return cleanText(value).toUpperCase() || "BILINMIYOR";
}

function getDayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getMonthKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function getTrendLabel(key, monthly) {
  const date = new Date(monthly ? `${key}-01T12:00:00+05:00` : `${key}T12:00:00+05:00`);
  return new Intl.DateTimeFormat("tr-TR", monthly
    ? { timeZone: DASHBOARD_TIMEZONE, month: "short" }
    : { timeZone: DASHBOARD_TIMEZONE, day: "2-digit", month: "short" }
  ).format(date);
}

export function getAnalyticsRange(rangeKey = "30d", now = new Date()) {
  const safeRangeKey = ANALYTICS_RANGES[rangeKey] ? rangeKey : "30d";
  const starts = getRangeStarts(now);
  let start = starts.startOfToday;

  if (safeRangeKey === "7d") {
    start = new Date(starts.startOfToday.getTime() - 6 * DAY_MS);
  } else if (safeRangeKey === "30d") {
    start = new Date(starts.startOfToday.getTime() - 29 * DAY_MS);
  } else if (safeRangeKey === "year") {
    start = starts.startOfYear;
  }

  return {
    key: safeRangeKey,
    label: ANALYTICS_RANGES[safeRangeKey].label,
    start,
    end: now,
  };
}

function buildTrend(visitRows, pageViewRows, range) {
  const monthly = range.key === "year";
  const map = new Map();

  if (monthly) {
    const [startYear, startMonth] = getMonthKey(range.start).split("-").map(Number);
    const [endYear, endMonth] = getMonthKey(range.end).split("-").map(Number);
    let year = startYear;
    let month = startMonth;

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      map.set(key, {
        key,
        label: getTrendLabel(key, monthly),
        visitors: new Set(),
        pageViews: 0,
      });
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  } else {
    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      const key = getDayKey(cursor);
      map.set(key, {
        key,
        label: getTrendLabel(key, monthly),
        visitors: new Set(),
        pageViews: 0,
      });
      cursor.setTime(cursor.getTime() + DAY_MS);
    }
  }

  visitRows.forEach((row) => {
    const date = normalizeVisitDate(row?.visitedAt);
    if (!date) return;
    const key = monthly ? getMonthKey(date) : getDayKey(date);
    const bucket = map.get(key);
    const visitorId = cleanText(row?.visitorId);
    if (bucket && visitorId) bucket.visitors.add(visitorId);
  });

  pageViewRows.forEach((row) => {
    const date = normalizeVisitDate(row?.visitedAt);
    if (!date) return;
    const key = monthly ? getMonthKey(date) : getDayKey(date);
    const bucket = map.get(key);
    if (bucket) bucket.pageViews += 1;
  });

  return Array.from(map.values()).map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    visitors: bucket.visitors.size,
    pageViews: bucket.pageViews,
  }));
}

function buildTopPages(pageViewRows, productNames) {
  const map = new Map();

  pageViewRows.forEach((row) => {
    const pathname = cleanText(row?.pathname);
    if (!pathname) return;
    const current = map.get(pathname) || {
      pathname,
      label: getPageLabel(row, productNames),
      pageType: row?.pageType === "product" ? "product" : "page",
      views: 0,
      visitors: new Set(),
    };
    current.views += 1;
    if (row?.visitorId) current.visitors.add(cleanText(row.visitorId));
    map.set(pathname, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
    .map((item) => ({
      pathname: item.pathname,
      label: item.label,
      pageType: item.pageType,
      views: item.views,
      visitors: item.visitors.size,
    }));
}

function buildTopProducts(pageViewRows, productNames) {
  const map = new Map();

  pageViewRows.forEach((row) => {
    const slug = cleanText(row?.productSlug);
    if (row?.pageType !== "product" || !slug) return;
    const current = map.get(slug) || {
      slug,
      label: productNames[slug] || getPageLabel(row, productNames),
      views: 0,
      visitors: new Set(),
    };
    current.views += 1;
    if (row?.visitorId) current.visitors.add(cleanText(row.visitorId));
    map.set(slug, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
    .map((item) => ({
      slug: item.slug,
      label: item.label,
      views: item.views,
      visitors: item.visitors.size,
    }));
}

function buildCountries(visitRows) {
  const map = new Map();

  visitRows.forEach((row) => {
    const code = normalizeCountry(row?.country);
    const current = map.get(code) || { code, sessions: 0, visitors: new Set() };
    current.sessions += 1;
    if (row?.visitorId) current.visitors.add(cleanText(row.visitorId));
    map.set(code, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.visitors.size - a.visitors.size)
    .map((item) => ({
      code: item.code,
      visitors: item.visitors.size,
      sessions: item.sessions,
    }));
}

export function buildAnalyticsOverview({
  visitRows = [],
  pageViewRows = [],
  productNames = {},
  rangeKey = "30d",
  now = new Date(),
  maxVisitors = 100,
}) {
  const range = getAnalyticsRange(rangeKey, now);
  const visitorIds = new Set();
  const kazakhstanVisitorIds = new Set();

  visitRows.forEach((row) => {
    const visitorId = cleanText(row?.visitorId);
    if (visitorId) visitorIds.add(visitorId);
    if (visitorId && normalizeCountry(row?.country) === "KZ") {
      kazakhstanVisitorIds.add(visitorId);
    }
  });

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
      pageViews: pageViewRows.length,
      sessions: visitRows.length,
      uniquePages: new Set(pageViewRows.map((row) => cleanText(row?.pathname)).filter(Boolean)).size,
      kazakhstanVisitors,
      otherVisitors: Math.max(uniqueVisitors - kazakhstanVisitors, 0),
      kazakhstanRatio: uniqueVisitors ? Math.round((kazakhstanVisitors / uniqueVisitors) * 100) : 0,
    },
    trend: buildTrend(visitRows, pageViewRows, range),
    topPages: buildTopPages(pageViewRows, productNames),
    topProducts: buildTopProducts(pageViewRows, productNames),
    countries: buildCountries(visitRows),
    visitorDetails: buildVisitorDetails(pageViewRows, productNames, maxVisitors),
  };
}
