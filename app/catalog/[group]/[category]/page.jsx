//app/catalog/[group]/[category]/page.jsx
import CatalogListingClient from "../../../components/CatalogListingClient";
import { getCatalogCategoryStaticParams } from "../../../lib/catalog/catalogStaticParams";
import { getServerCatalogProducts } from "../../../lib/server/catalogProducts";
import { buildCatalogMetadata } from "../../../lib/server/catalogSeo";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getCatalogCategoryStaticParams();
}

export async function generateMetadata({ params }) {
  const { group, category } = await params;

  return buildCatalogMetadata({ group, category });
}

export default async function CatalogCategoryPage({ params, searchParams }) {
  const [{ group, category }, initialSearchParams] = await Promise.all([params, searchParams]);
  const initialProducts = await getServerCatalogProducts({
    groupKey: group,
    categoryKey: category,
  });

  return <CatalogListingClient group={group} category={category} initialProducts={initialProducts} initialSearchParams={initialSearchParams} />;
}
