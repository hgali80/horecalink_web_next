import { NextResponse } from "next/server";

import {
  STAFF_ROLES,
  authorizeAdminRequest,
} from "@/app/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const DASHBOARD_TIMEZONE = "Asia/Qyzylorda";
const DASHBOARD_OFFSET = "+05:00";
const WEEKDAY_INDEX = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function getZonedParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    weekday: partMap.weekday,
  };
}

function buildZonedDate(year, month, day) {
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");

  return new Date(`${year}-${paddedMonth}-${paddedDay}T00:00:00${DASHBOARD_OFFSET}`);
}

function getRangeStarts(now = new Date()) {
  const zoned = getZonedParts(now);
  const startOfToday = buildZonedDate(zoned.year, zoned.month, zoned.day);
  const startOfMonth = buildZonedDate(zoned.year, zoned.month, 1);
  const startOfYear = buildZonedDate(zoned.year, 1, 1);
  const weekdayIndex = WEEKDAY_INDEX[zoned.weekday] ?? 0;
  const startOfWeek = new Date(startOfToday.getTime() - weekdayIndex * 24 * 60 * 60 * 1000);

  return {
    now,
    startOfToday,
    startOfWeek,
    startOfMonth,
    startOfYear,
  };
}

function createPeriod(label) {
  return {
    label,
    totalVisits: 0,
    uniqueVisitors: 0,
    visitorIds: new Set(),
  };
}

function normalizeVisitDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

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

    const periods = {
      today: createPeriod("Bugun"),
      week: createPeriod("Bu hafta"),
      month: createPeriod("Bu ay"),
      year: createPeriod("Bu yil"),
    };

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const visitedAt = normalizeVisitDate(data.visitedAt);
      const visitorId = String(data.visitorId || "").trim();

      if (!visitedAt) {
        return;
      }

      if (visitedAt >= ranges.startOfYear) {
        periods.year.totalVisits += 1;
        if (visitorId) periods.year.visitorIds.add(visitorId);
      }

      if (visitedAt >= ranges.startOfMonth) {
        periods.month.totalVisits += 1;
        if (visitorId) periods.month.visitorIds.add(visitorId);
      }

      if (visitedAt >= ranges.startOfWeek) {
        periods.week.totalVisits += 1;
        if (visitorId) periods.week.visitorIds.add(visitorId);
      }

      if (visitedAt >= ranges.startOfToday) {
        periods.today.totalVisits += 1;
        if (visitorId) periods.today.visitorIds.add(visitorId);
      }
    });

    const responsePeriods = Object.fromEntries(
      Object.entries(periods).map(([key, period]) => [
        key,
        {
          label: period.label,
          totalVisits: period.totalVisits,
          uniqueVisitors: period.visitorIds.size,
        },
      ])
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
