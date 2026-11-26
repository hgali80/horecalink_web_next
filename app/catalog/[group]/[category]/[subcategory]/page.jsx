//app/catalog/[group]/[category]/[subcategory]/page.jsx
import CatalogListingClient from "../../../../components/CatalogListingClient";
import { getCatalogSubcategoryStaticParams } from "../../../../lib/catalog/catalogStaticParams";
import { getServerCatalogProducts } from "../../../../lib/server/catalogProducts";
import { buildCatalogMetadata } from "../../../../lib/server/catalogSeo";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getCatalogSubcategoryStaticParams();
}

export async function generateMetadata({ params }) {
  const { group, category, subcategory } = await params;

  return buildCatalogMetadata({ group, category, subcategory });
}

export default async function CatalogSubcategoryPage({ params, searchParams }) {
  const [{ group, category, subcategory }, initialSearchParams] = await Promise.all([params, searchParams]);
  const initialProducts = await getServerCatalogProducts({
    groupKey: group,
    categoryKey: category,
    subcategoryKey: subcategory,
  });

  return <CatalogListingClient
    group={group}
    category={category}
    subcategory={subcategory}
    initialProducts={initialProducts}
    initialSearchParams={initialSearchParams}
  />;
}
