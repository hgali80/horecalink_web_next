import "server-only";

import { getAdminServices } from "./firebaseAdmin";

const IMAGE_FOLDER = "product_images/";

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

function withImageExtension(value) {
  const text = cleanText(value);
  if (!text) return "";
  return /\.[a-z0-9]+$/i.test(text) ? text : `${text}.jpg`;
}

function toImageStem(value) {
  return cleanText(value).replace(/\.[a-z0-9]+$/i, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getImageSortOrder(filename, stem) {
  const exactPattern = new RegExp(`^${escapeRegex(stem)}\\.[a-z0-9]+$`, "i");
  if (exactPattern.test(filename)) return 0;

  const numberedMatch = filename.match(
    new RegExp(`^${escapeRegex(stem)}-(\\d+)\\.[a-z0-9]+$`, "i")
  );

  if (!numberedMatch) return Number.MAX_SAFE_INTEGER;
  return Number(numberedMatch[1]);
}

function getCandidateStems(product) {
  const values = [
    product?.stock_code,
    product?.sku,
    product?.manufacturerCode,
    product?.imageBase,
    product?.id,
  ];

  return Array.from(new Set(values.map((value) => toImageStem(value)).filter(Boolean)));
}

function getExistingImageNames(product) {
  const names = Array.isArray(product?.image_names) ? product.image_names : [];
  return Array.from(new Set(names.map((name) => withImageExtension(name)).filter(Boolean)));
}

async function listImagesForStem(bucket, stem) {
  const [files] = await bucket.getFiles({
    prefix: `${IMAGE_FOLDER}${stem}`,
  });

  const pattern = new RegExp(`^${escapeRegex(stem)}(?:-(\\d+))?\\.[a-z0-9]+$`, "i");

  return files
    .map((file) => file.name.replace(IMAGE_FOLDER, ""))
    .filter((name) => pattern.test(name))
    .sort((a, b) => getImageSortOrder(a, stem) - getImageSortOrder(b, stem));
}

export async function hydrateProductImageNames(product) {
  if (!product) return product;

  const existingImageNames = getExistingImageNames(product);
  const stems = getCandidateStems(product);

  if (!stems.length) {
    return {
      ...product,
      image_names: existingImageNames,
    };
  }

  try {
    const { adminStorage } = getAdminServices();
    const bucket = adminStorage.bucket();
    const discoveredGroups = await Promise.all(
      stems.map((stem) => listImagesForStem(bucket, stem))
    );

    return {
      ...product,
      image_names: Array.from(
        new Set([...existingImageNames, ...discoveredGroups.flat()])
      ),
    };
  } catch {
    return {
      ...product,
      image_names: existingImageNames,
    };
  }
}
