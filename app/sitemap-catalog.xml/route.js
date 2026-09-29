import {
  buildUrlEntry,
  createUrlsetResponse,
  getBaseUrl,
  getPublishedProductsForSitemap,
  getTodayDate,
} from "../lib/server/sitemapUtils";
import { normalizeCatalogPath } from "../lib/catalog/catalogKeys";
export const revalidate = 3600;
export const dynamic = "force-static";

export async function GET() {
  const baseUrl = getBaseUrl();
  const today = getTodayDate();
  const products = await getPublishedProductsForSitemap();

  const seen = new Map();

  for (const product of products) {
    const { group, category, subcategory } = normalizeCatalogPath({
      group: product.groupKey,
      category: product.categoryKey,
      subcategory: product.subcategoryKey,
    });

    if (!group) continue;

    const groupPath = `/catalog/${group}`;
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

    if (!category) continue;

    const categoryPath = `${groupPath}/${category}`;
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

    if (!subcategory) continue;

    const subcategoryPath = `${categoryPath}/${subcategory}`;
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
