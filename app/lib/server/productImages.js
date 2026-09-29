import "server-only";

import { getStoredProductImageNames } from "../productImageNames.mjs";

// Image discovery runs at import/maintenance time. Public requests only use
// the persisted list, shared by metadata and the page's request memoization.
export function hydrateProductImageNames(product) {
  if (!product) return product;
  return { ...product, image_names: getStoredProductImageNames(product) };
}
