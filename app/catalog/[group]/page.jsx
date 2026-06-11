//app/catalog/[group]/page.jsx
import CatalogListingClient from "../../components/CatalogListingClient";
import { buildCatalogMetadata } from "../../lib/server/catalogSeo";

export async function generateMetadata({ params }) {
  const { group } = await params;

  return buildCatalogMetadata({ group });
}

export default async function CatalogGroupPage({ params }) {
  const { group } = await params;

  return <CatalogListingClient group={group} />;
}
