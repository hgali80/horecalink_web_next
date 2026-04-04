import {
  buildSitemapEntry,
  createSitemapIndexResponse,
  getBaseUrl,
  getTodayDate,
} from "../lib/server/sitemapUtils";
export const revalidate = 3600;

export async function GET() {
  const baseUrl = getBaseUrl();
  const today = getTodayDate();

  return createSitemapIndexResponse([
    buildSitemapEntry({ loc: `${baseUrl}/sitemap-static.xml`, lastmod: today }),
    buildSitemapEntry({ loc: `${baseUrl}/sitemap-catalog.xml`, lastmod: today }),
    buildSitemapEntry({ loc: `${baseUrl}/sitemap-products.xml`, lastmod: today }),
  ]);
}
