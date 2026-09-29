import "server-only";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import {
  getProductBySlug,
  getProductFamilyVariants,
  getRelatedProducts,
} from "../firestore/products";
import { hydrateProductImageNames } from "./productImages";
import { PUBLIC_PRODUCTS_CACHE_TAG } from "./cacheTags";

const getCachedProductPageData = unstable_cache(
  async (slug) => {
    const product = await getProductBySlug(slug);
    if (!product) return null;

    const hydratedProduct = await hydrateProductImageNames(product);
    const [relatedProducts, familyVariants] = await Promise.all([
      getRelatedProducts(hydratedProduct, 6),
      getProductFamilyVariants(hydratedProduct),
    ]);

    return {
      product: hydratedProduct,
      relatedProducts,
      familyVariants,
    };
  },
  ["public-product-page-data-v1"],
  {
    revalidate: 3600,
    tags: [PUBLIC_PRODUCTS_CACHE_TAG],
  }
);

export function getProductPageData(slug) {
  return getCachedProductPageData(slug);
}

export function revalidatePublicProductPages() {
  try {
    revalidateTag(PUBLIC_PRODUCTS_CACHE_TAG);
    revalidatePath("/sitemap-products.xml");
    revalidatePath("/sitemap-catalog.xml");
    return true;
  } catch (error) {
    console.error("Public product cache revalidation failed", error);
    return false;
  }
}
