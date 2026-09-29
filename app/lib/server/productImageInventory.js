import "server-only";

import { getAdminServices } from "./firebaseAdmin";
import { buildProductImageIndex } from "../productImageNames.mjs";

export async function loadProductImageIndex() {
  const { adminStorage } = getAdminServices();
  const bucketName = process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "horecakatalog-e2d10.firebasestorage.app";
  const [files] = await adminStorage.bucket(bucketName).getFiles({ prefix: "product_images/" });
  return buildProductImageIndex(files.map(file => file.name.slice("product_images/".length)));
}
