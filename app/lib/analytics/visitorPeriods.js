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

export function getRangeStarts(now = new Date()) {
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
    kazakhstanTotalVisits: 0,
    kazakhstanUniqueVisitors: 0,
    visitorIds: new Set(),
    kazakhstanVisitorIds: new Set(),
  };
}

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function applyVisitToPeriod(period, visitorId, country) {
  period.totalVisits += 1;
  if (visitorId) {
    period.visitorIds.add(visitorId);
  }

  if (country === "KZ") {
    period.kazakhstanTotalVisits += 1;
    if (visitorId) {
      period.kazakhstanVisitorIds.add(visitorId);
    }
  }
}

export function normalizeVisitDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function buildVisitorPeriods(visitRows, ranges = getRangeStarts()) {
  const periods = {
    today: createPeriod("Bugun"),
    week: createPeriod("Bu hafta"),
    month: createPeriod("Bu ay"),
    year: createPeriod("Bu yil"),
  };

  visitRows.forEach((item) => {
    const visitedAt = normalizeVisitDate(item?.visitedAt);
    const visitorId = String(item?.visitorId || "").trim();
    const country = normalizeCountry(item?.country);

    if (!visitedAt) return;

    if (visitedAt >= ranges.startOfYear) {
      applyVisitToPeriod(periods.year, visitorId, country);
    }

    if (visitedAt >= ranges.startOfMonth) {
      applyVisitToPeriod(periods.month, visitorId, country);
    }

    if (visitedAt >= ranges.startOfWeek) {
      applyVisitToPeriod(periods.week, visitorId, country);
    }

    if (visitedAt >= ranges.startOfToday) {
      applyVisitToPeriod(periods.today, visitorId, country);
    }
  });

  return Object.fromEntries(
    Object.entries(periods).map(([key, period]) => [
      key,
      {
        label: period.label,
        totalVisits: period.totalVisits,
        uniqueVisitors: period.visitorIds.size,
        globalTotalVisits: period.totalVisits,
        globalUniqueVisitors: period.visitorIds.size,
        kazakhstanTotalVisits: period.kazakhstanTotalVisits,
        kazakhstanUniqueVisitors: period.kazakhstanVisitorIds.size,
      },
    ])
  );
}

export { DASHBOARD_TIMEZONE };
