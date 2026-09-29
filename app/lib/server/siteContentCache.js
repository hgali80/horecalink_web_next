import "server-only";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import { BANNER_DEFAULTS } from "../homeBanner";
import { getAdminServices } from "./firebaseAdmin";

const HOME_BANNER_CACHE_TAG = "site-content-home-banner";
const CATEGORY_IMAGES_CACHE_TAG = "site-content-category-images";

const getCachedHomeBanner = unstable_cache(
  async () => {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection("siteContent").doc("homeBanner").get();
    return snapshot.exists ? snapshot.data() : BANNER_DEFAULTS;
  },
  ["site-content-home-banner-v1"],
  { revalidate: 3600, tags: [HOME_BANNER_CACHE_TAG] }
);

const getCachedCategoryImages = unstable_cache(
  async () => {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection("siteContent").doc("categoryImages").get();
    return snapshot.data() || { images: {} };
  },
  ["site-content-category-images-v1"],
  { revalidate: 3600, tags: [CATEGORY_IMAGES_CACHE_TAG] }
);

export function getPublicHomeBanner() {
  return getCachedHomeBanner();
}

export function getPublicCategoryImages() {
  return getCachedCategoryImages();
}

export function revalidateHomeBannerCache() {
  try {
    revalidateTag(HOME_BANNER_CACHE_TAG);
    revalidatePath("/api/home-banner");
    return true;
  } catch (error) {
    console.error("Home banner cache revalidation failed", error);
    return false;
  }
}

export function revalidateCategoryImagesCache() {
  try {
    revalidateTag(CATEGORY_IMAGES_CACHE_TAG);
    revalidatePath("/api/category-images");
    return true;
  } catch (error) {
    console.error("Category images cache revalidation failed", error);
    return false;
  }
}
