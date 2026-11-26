//app/catalog/[group]/page.jsx
import CatalogListingClient from "../../components/CatalogListingClient";
import { getCatalogGroupStaticParams } from "../../lib/catalog/catalogStaticParams";
import { getServerCatalogProducts } from "../../lib/server/catalogProducts";
import { buildCatalogMetadata } from "../../lib/server/catalogSeo";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getCatalogGroupStaticParams();
}

export async function generateMetadata({ params }) {
  const { group } = await params;

  return buildCatalogMetadata({ group });
}

export default async function CatalogGroupPage({ params, searchParams }) {
  const [{ group }, initialSearchParams] = await Promise.all([params, searchParams]);
  const initialProducts = await getServerCatalogProducts({ groupKey: group });

  return <CatalogListingClient group={group} initialProducts={initialProducts} initialSearchParams={initialSearchParams} />;
}
