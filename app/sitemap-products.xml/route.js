import {
  buildUrlEntry,
  createUrlsetResponse,
  getBaseUrl,
  getPublishedProductsForSitemap,
  getTodayDate,
} from "../lib/server/sitemapUtils";
export const revalidate = 3600;
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = getBaseUrl();
  const today = getTodayDate();
  const products = await getPublishedProductsForSitemap();

  return createUrlsetResponse(
    products.map((product) =>
      buildUrlEntry({
        loc: `${baseUrl}/products/${product.slug}`,
        lastmod: product.updatedAt || today,
        changefreq: "weekly",
        priority: 0.8,
      })
    )
  );
}
