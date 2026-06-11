//app/catalog/[group]/[category]/page.jsx
import CatalogListingClient from "../../../components/CatalogListingClient";
import { buildCatalogMetadata } from "../../../lib/server/catalogSeo";

export async function generateMetadata({ params }) {
  const { group, category } = await params;

  return buildCatalogMetadata({ group, category });
}

export default async function CatalogCategoryPage({ params }) {
  const { group, category } = await params;

  return <CatalogListingClient group={group} category={category} />;
}
