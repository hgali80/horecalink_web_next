//app/catalog/[group]/page.jsx
import CatalogListingClient from "../../components/CatalogListingClient";

export default async function CatalogGroupPage({ params }) {
  const { group } = await params;

  return <CatalogListingClient group={group} />;
}