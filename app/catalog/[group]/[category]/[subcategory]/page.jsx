//app/catalog/[group]/[category]/[subcategory]/page.jsx
import CatalogListingClient from "../../../../components/CatalogListingClient";

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