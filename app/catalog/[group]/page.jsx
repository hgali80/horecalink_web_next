//app/catalog/[group]/page.jsx
import { Suspense } from "react";

import CatalogListingClient from "../../components/CatalogListingClient";
import CatalogListingFallback from "../../components/CatalogListingFallback";
import { getCatalogGroupStaticParams } from "../../lib/catalog/catalogStaticParams";
import { buildCatalogMetadata } from "../../lib/server/catalogSeo";

export function generateStaticParams() {
  return getCatalogGroupStaticParams();
}

export async function generateMetadata({ params }) {
  const { group } = await params;

  return buildCatalogMetadata({ group });
}

export default async function CatalogGroupPage({ params }) {
  const { group } = await params;

  return (
    <Suspense fallback={<CatalogListingFallback />}>
      <CatalogListingClient group={group} />
    </Suspense>
  );
}
