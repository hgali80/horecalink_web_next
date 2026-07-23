import { normalizeVisitDate } from "./visitorPeriods";

const PAGE_LABELS = {
  "/": "Ana sayfa",
  "/products": "Urunler",
  "/catalog": "Katalog",
  "/categories": "Kategoriler",
  "/usage-areas": "Kullanim alanlari",
  "/about": "Hakkimizda",
  "/contact": "Iletisim",
  "/teklif-talep": "Teklif talebi",
};

function cleanText(value) {
  return String(value || "").trim();
}

function titleFromPath(pathname) {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];

  return pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part).replace(/[-_]+/g, " ");
      } catch {
        return part.replace(/[-_]+/g, " ");
      }
    })
    .join(" / ") || "Bilinmeyen sayfa";
}

export function getPageLabel(item, productNames = {}) {
  const productSlug = cleanText(item?.productSlug);
  if (item?.pageType === "product" && productSlug) {
    return productNames[productSlug] || titleFromPath(`/products/${productSlug}`).replace("products / ", "");
  }

  return titleFromPath(cleanText(item?.pathname));
}

export function buildVisitorDetails(pageViewRows, productNames = {}, maxVisitors = 50) {
  const visitorMap = new Map();

  [...(pageViewRows || [])]
    .map((item) => ({ ...item, normalizedVisitedAt: normalizeVisitDate(item?.visitedAt) }))
    .filter((item) => item.normalizedVisitedAt && cleanText(item?.visitorId))
    .sort((a, b) => b.normalizedVisitedAt - a.normalizedVisitedAt)
    .forEach((item) => {
      const visitorId = cleanText(item.visitorId);
      let visitor = visitorMap.get(visitorId);

      if (!visitor) {
        visitor = {
          visitorId,
          country: cleanText(item.country) || null,
          lastVisitedAt: item.normalizedVisitedAt,
          firstVisitedAt: item.normalizedVisitedAt,
          userAgent: cleanText(item.userAgent),
          referrer: cleanText(item.referrer),
          pageViewCount: 0,
          sessionIds: new Set(),
          pages: new Map(),
        };
        visitorMap.set(visitorId, visitor);
      }

      visitor.firstVisitedAt = item.normalizedVisitedAt;
      visitor.pageViewCount += 1;
      if (item.sessionId) visitor.sessionIds.add(cleanText(item.sessionId));
      if (!visitor.country && item.country) visitor.country = cleanText(item.country);
      if (!visitor.userAgent && item.userAgent) visitor.userAgent = cleanText(item.userAgent);
      if (!visitor.referrer && item.referrer) visitor.referrer = cleanText(item.referrer);

      const pathname = cleanText(item.pathname);
      const existingPage = visitor.pages.get(pathname);
      if (existingPage) {
        existingPage.viewCount += 1;
      } else {
        visitor.pages.set(pathname, {
          pathname,
          label: getPageLabel(item, productNames),
          pageType: item.pageType === "product" ? "product" : "page",
          productSlug: cleanText(item.productSlug) || null,
          viewCount: 1,
          lastVisitedAt: item.normalizedVisitedAt.toISOString(),
        });
      }
    });

  return Array.from(visitorMap.values())
    .slice(0, maxVisitors)
    .map((visitor) => ({
      visitorId: visitor.visitorId,
      displayId: visitor.visitorId.slice(-6).toUpperCase(),
      country: visitor.country,
      lastVisitedAt: visitor.lastVisitedAt.toISOString(),
      firstVisitedAt: visitor.firstVisitedAt.toISOString(),
      userAgent: visitor.userAgent,
      referrer: visitor.referrer,
      pageViewCount: visitor.pageViewCount,
      sessionCount: visitor.sessionIds.size,
      uniquePageCount: visitor.pages.size,
      pages: Array.from(visitor.pages.values()),
    }));
}
