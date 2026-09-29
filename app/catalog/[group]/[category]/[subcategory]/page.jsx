//app/catalog/[group]/[category]/[subcategory]/page.jsx
import { Suspense } from "react";

import CatalogListingClient from "../../../../components/CatalogListingClient";
import CatalogListingFallback from "../../../../components/CatalogListingFallback";
import { getCatalogSubcategoryStaticParams } from "../../../../lib/catalog/catalogStaticParams";
import { buildCatalogMetadata } from "../../../../lib/server/catalogSeo";

export function generateStaticParams() {
  return getCatalogSubcategoryStaticParams();
}

export async function generateMetadata({ params }) {
  const { group, category, subcategory } = await params;

  return buildCatalogMetadata({ group, category, subcategory });
}

export default async function CatalogSubcategoryPage({ params }) {
  const { group, category, subcategory } = await params;

  return (
    <Suspense fallback={<CatalogListingFallback />}>
      <CatalogListingClient
        group={group}
        category={category}
        subcategory={subcategory}
      />
    </Suspense>
  );
}
