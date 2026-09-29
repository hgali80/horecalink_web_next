//app/catalog/[group]/[category]/page.jsx
import { Suspense } from "react";

import CatalogListingClient from "../../../components/CatalogListingClient";
import CatalogListingFallback from "../../../components/CatalogListingFallback";
import { getCatalogCategoryStaticParams } from "../../../lib/catalog/catalogStaticParams";
import { buildCatalogMetadata } from "../../../lib/server/catalogSeo";

export function generateStaticParams() {
  return getCatalogCategoryStaticParams();
}

export async function generateMetadata({ params }) {
  const { group, category } = await params;

  return buildCatalogMetadata({ group, category });
}

export default async function CatalogCategoryPage({ params }) {
  const { group, category } = await params;

  return (
    <Suspense fallback={<CatalogListingFallback />}>
      <CatalogListingClient group={group} category={category} />
    </Suspense>
  );
}
