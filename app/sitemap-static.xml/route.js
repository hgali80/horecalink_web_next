import {
  buildUrlEntry,
  createUrlsetResponse,
  getBaseUrl,
  getTodayDate,
} from "../lib/server/sitemapUtils";
export const revalidate = 3600;
export const dynamic = "force-dynamic";

const STATIC_PAGES = [
  { path: "/", changefreq: "daily", priority: 1.0 },
  { path: "/about", changefreq: "monthly", priority: 0.6 },
  { path: "/catalog", changefreq: "daily", priority: 0.9 },
  { path: "/categories", changefreq: "weekly", priority: 0.7 },
  { path: "/products", changefreq: "daily", priority: 0.8 },
  { path: "/contact", changefreq: "monthly", priority: 0.5 },
  { path: "/privacy", changefreq: "yearly", priority: 0.3 },
  { path: "/shipping", changefreq: "yearly", priority: 0.3 },
  { path: "/iade-politikasi", changefreq: "yearly", priority: 0.3 },
  { path: "/payment", changefreq: "yearly", priority: 0.3 },
  { path: "/teklif-talep", changefreq: "weekly", priority: 0.7 },
];

export async function GET() {
  const baseUrl = getBaseUrl();
  const today = getTodayDate();

  return createUrlsetResponse(
    STATIC_PAGES.map((page) =>
      buildUrlEntry({
        loc: `${baseUrl}${page.path}`,
        lastmod: today,
        changefreq: page.changefreq,
        priority: page.priority,
      })
    )
  );
}
