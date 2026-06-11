//app/catalog/[group]/[category]/[subcategory]/page.jsx
import CatalogListingClient from "../../../../components/CatalogListingClient";
import { buildCatalogMetadata } from "../../../../lib/server/catalogSeo";

export async function generateMetadata({ params }) {
  const { group, category, subcategory } = await params;

  return buildCatalogMetadata({ group, category, subcategory });
}

export default async function CatalogSubcategoryPage({ params }) {
  const { group, category, subcategory } = await params;

  return (
    <CatalogListingClient
      group={group}
      category={category}
      subcategory={subcategory}
    />
  );
}
