import "server-only";

import { unstable_cache } from "next/cache";
import { getFirestore } from "firebase-admin/firestore";

import { normalizeProduct } from "../firestore/products";
import { canonicalCatalogKey } from "../catalog/catalogKeys";
import { compareProductsByCategoryOrder } from "../catalog/productSort";
import { getAdminApp } from "./firebaseAdmin";
import { PUBLIC_PRODUCTS_CACHE_TAG } from "./cacheTags";

const getCachedCatalogProducts = unstable_cache(
  async (groupKey, categoryKey, subcategoryKey) => {
    let query = getFirestore(getAdminApp())
      .collection("products")
      .where("groupKey", "==", groupKey)
      .where("active", "==", true)
      .where("webPublished", "==", true);

    if (categoryKey) query = query.where("categoryKey", "==", categoryKey);
    if (subcategoryKey) query = query.where("subcategoryKey", "==", subcategoryKey);

    const snapshot = await query.get();

    return snapshot.docs
      .map(normalizeProduct)
      .sort(compareProductsByCategoryOrder);
  },
  ["public-catalog-listing-admin-v1"],
  { revalidate: 300, tags: [PUBLIC_PRODUCTS_CACHE_TAG] }
);

export function getServerCatalogProducts({
  groupKey,
  categoryKey = null,
  subcategoryKey = null,
}) {
  return getCachedCatalogProducts(
    canonicalCatalogKey("group", groupKey),
    categoryKey ? canonicalCatalogKey("main", categoryKey) : null,
    subcategoryKey ? canonicalCatalogKey("sub", subcategoryKey) : null
  );
}
