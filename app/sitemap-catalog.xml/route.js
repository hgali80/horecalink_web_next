import {
  buildUrlEntry,
  createUrlsetResponse,
  getBaseUrl,
  getPublishedProductsForSitemap,
  getTodayDate,
} from "../lib/server/sitemapUtils";
export const revalidate = 3600;

export async function GET() {
  const baseUrl = getBaseUrl();
  const today = getTodayDate();
  const products = await getPublishedProductsForSitemap();

  const seen = new Map();

  for (const product of products) {
    if (!product.groupKey) continue;

    const groupPath = `/catalog/${product.groupKey}`;
    if (!seen.has(groupPath)) {
      seen.set(
        groupPath,
        buildUrlEntry({
          loc: `${baseUrl}${groupPath}`,
          lastmod: product.updatedAt || today,
          changefreq: "daily",
          priority: 0.8,
        })
      );
    }

    if (!product.categoryKey) continue;

    const categoryPath = `${groupPath}/${product.categoryKey}`;
    if (!seen.has(categoryPath)) {
      seen.set(
        categoryPath,
        buildUrlEntry({
          loc: `${baseUrl}${categoryPath}`,
          lastmod: product.updatedAt || today,
          changefreq: "weekly",
          priority: 0.7,
        })
      );
    }

    if (!product.subcategoryKey) continue;

    const subcategoryPath = `${categoryPath}/${product.subcategoryKey}`;
    if (!seen.has(subcategoryPath)) {
      seen.set(
        subcategoryPath,
        buildUrlEntry({
          loc: `${baseUrl}${subcategoryPath}`,
          lastmod: product.updatedAt || today,
          changefreq: "weekly",
          priority: 0.6,
        })
      );
    }
  }

  return createUrlsetResponse(Array.from(seen.values()));
}
