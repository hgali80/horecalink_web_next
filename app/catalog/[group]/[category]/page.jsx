//app/catalog/[group]/[category]/page.jsx
import CatalogListingClient from "../../../components/CatalogListingClient";

export default async function CatalogCategoryPage({ params }) {
  const { group, category } = await params;

  return <CatalogListingClient group={group} category={category} />;
}