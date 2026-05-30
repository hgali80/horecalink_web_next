"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { db, storage } from "../../firebase";

const DEFAULT_USAGE_AREA_ID = "default-usage-area";
const USAGE_AREA_IMAGE_FOLDER = "usage_areas";
const PLACEHOLDER_IMAGE = "/Placeholder.png";

const CYRILLIC_MAP = {
  а: "a",
  ә: "a",
  б: "b",
  в: "v",
  г: "g",
  ғ: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  қ: "k",
  л: "l",
  м: "m",
  н: "n",
  ң: "n",
  о: "o",
  ө: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ұ: "u",
  ү: "u",
  ф: "f",
  х: "h",
  һ: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "y",
  і: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === "string") return value;
  return null;
}

function transliterate(value) {
  return String(value || "")
    .split("")
    .map((char) => {
      const lower = char.toLowerCase();
      const mapped = CYRILLIC_MAP[lower];
      if (mapped !== undefined) return mapped;
      return lower;
    })
    .join("");
}

export function slugifyUsageArea(value, fallback = "usage-area") {
  const normalized = transliterate(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function pickSlugSource(raw = {}) {
  return (
    cleanText(raw.name_tr) ||
    cleanText(raw.name_ru) ||
    cleanText(raw.name_kz) ||
    cleanText(raw.name_en) ||
    "usage-area"
  );
}

function resolveSlugSource(raw = {}) {
  return cleanText(raw.slug) || pickSlugSource(raw);
}

function uniqueArray(values) {
  return Array.from(new Set((values || []).map((item) => cleanText(item)).filter(Boolean)));
}

function resolveImageUrl(data = {}) {
  const directUrl = cleanText(data.imageUrl);
  if (directUrl) return directUrl;

  const imagePath = cleanText(data.imagePath);
  if (imagePath) {
    return `https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/${encodeURIComponent(
      imagePath
    )}?alt=media`;
  }

  return PLACEHOLDER_IMAGE;
}

export function getUsageAreaName(area, lang) {
  return (
    cleanText(area?.[`name_${lang}`]) ||
    cleanText(area?.name_tr) ||
    cleanText(area?.name_ru) ||
    cleanText(area?.name_kz) ||
    cleanText(area?.name_en) ||
    ""
  );
}

export function getUsageAreaDescription(area, lang) {
  return (
    cleanText(area?.[`description_${lang}`]) ||
    cleanText(area?.description_tr) ||
    cleanText(area?.description_ru) ||
    cleanText(area?.description_kz) ||
    cleanText(area?.description_en) ||
    ""
  );
}

export function normalizeUsageArea(id, data = {}) {
  return {
    id,
    slug: cleanText(data.slug) || slugifyUsageArea(pickSlugSource(data), id || "usage-area"),
    name_tr: cleanText(data.name_tr),
    name_kz: cleanText(data.name_kz),
    name_ru: cleanText(data.name_ru),
    name_en: cleanText(data.name_en),
    description_tr: cleanText(data.description_tr),
    description_kz: cleanText(data.description_kz),
    description_ru: cleanText(data.description_ru),
    description_en: cleanText(data.description_en),
    imageName: cleanText(data.imageName),
    imagePath: cleanText(data.imagePath),
    imageUrl: cleanText(data.imageUrl),
    imagePreviewUrl: resolveImageUrl(data),
    isActive: asBoolean(data.isActive, true),
    showOnHome: asBoolean(data.showOnHome, true),
    order: asNumber(data.order, 0),
    productIds: uniqueArray(data.productIds),
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

async function createDefaultUsageAreaIfNeeded() {
  const areas = await listUsageAreas({ includeInactive: true });
  if (areas.length > 0) return areas;

  const ref = doc(db, "usage_areas", DEFAULT_USAGE_AREA_ID);
  await setDoc(ref, {
    slug: "kullanim-alani",
    name_tr: "Yeni Kullanım Alanı",
    name_kz: "Жаңа қолдану саласы",
    name_ru: "Новая сфера применения",
    name_en: "New usage area",
    description_tr: "Bu alan için kısa açıklama ekleyin.",
    description_kz: "Осы бөлім үшін қысқаша сипаттама қосыңыз.",
    description_ru: "Добавьте краткое описание для этого раздела.",
    description_en: "Add a short description for this section.",
    imageName: "",
    imagePath: "",
    imageUrl: "",
    isActive: true,
    showOnHome: true,
    order: 1,
    productIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return listUsageAreas({ includeInactive: true });
}

export async function listUsageAreas({
  activeOnly = false,
  homeOnly = false,
  limitCount = null,
  includeInactive = false,
} = {}) {
  const snapshot = await getDocs(collection(db, "usage_areas"));

  let items = snapshot.docs.map((item) => normalizeUsageArea(item.id, item.data()));

  if (activeOnly || !includeInactive) {
    items = items.filter((item) => item.isActive === true);
  }

  if (homeOnly) {
    items = items.filter((item) => item.showOnHome === true);
  }

  items = items.sort((a, b) => {
    const orderCompare = Number(a.order || 0) - Number(b.order || 0);
    if (orderCompare !== 0) return orderCompare;
    return cleanText(a.slug).localeCompare(cleanText(b.slug), "tr");
  });

  if (limitCount) {
    items = items.slice(0, limitCount);
  }

  return items;
}

export async function listUsageAreasEnsured() {
  return createDefaultUsageAreaIfNeeded();
}

export async function getUsageAreaById(id) {
  const usageAreaId = cleanText(id);
  if (!usageAreaId) return null;
  const snapshot = await getDoc(doc(db, "usage_areas", usageAreaId));
  if (!snapshot.exists()) return null;
  return normalizeUsageArea(snapshot.id, snapshot.data());
}

export async function getUsageAreaBySlug(slug) {
  const normalizedSlug = cleanText(slug);
  if (!normalizedSlug) return null;

  const snapshot = await getDocs(
    query(collection(db, "usage_areas"), where("slug", "==", normalizedSlug), limit(1))
  );

  if (snapshot.empty) return null;
  const docItem = snapshot.docs[0];
  return normalizeUsageArea(docItem.id, docItem.data());
}

export async function ensureUniqueUsageAreaSlug(raw, currentId = null) {
  const base = slugifyUsageArea(resolveSlugSource(raw));
  let candidate = base;
  let index = 2;

  while (true) {
    const snapshot = await getDocs(
      query(collection(db, "usage_areas"), where("slug", "==", candidate), limit(5))
    );

    const takenByAnother = snapshot.docs.some((item) => item.id !== currentId);
    if (!takenByAnother) return candidate;

    candidate = `${base}-${index}`;
    index += 1;
  }
}

export async function uploadUsageAreaImage({ usageAreaId, file }) {
  const id = cleanText(usageAreaId);
  if (!id) throw new Error("Kullanim alani kimligi gerekli.");
  if (!file) throw new Error("Gorsel secilmedi.");

  const extension = cleanText(file.name).split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${Date.now()}.${extension}`;
  const imagePath = `${USAGE_AREA_IMAGE_FOLDER}/${id}/${filename}`;
  const ref = storageRef(storage, imagePath);

  await uploadBytes(ref, file, { contentType: file.type || "image/jpeg" });
  const imageUrl = await getDownloadURL(ref);

  return {
    imageName: filename,
    imagePath,
    imageUrl,
  };
}

export async function removeUsageAreaImage(imagePath) {
  const path = cleanText(imagePath);
  if (!path) return;

  try {
    await deleteObject(storageRef(storage, path));
  } catch {}
}

function buildUsageAreaPayload(raw = {}) {
  return {
    slug: cleanText(raw.slug),
    name_tr: cleanText(raw.name_tr),
    name_kz: cleanText(raw.name_kz),
    name_ru: cleanText(raw.name_ru),
    name_en: cleanText(raw.name_en),
    description_tr: cleanText(raw.description_tr),
    description_kz: cleanText(raw.description_kz),
    description_ru: cleanText(raw.description_ru),
    description_en: cleanText(raw.description_en),
    imageName: cleanText(raw.imageName),
    imagePath: cleanText(raw.imagePath),
    imageUrl: cleanText(raw.imageUrl),
    isActive: asBoolean(raw.isActive, true),
    showOnHome: asBoolean(raw.showOnHome, true),
    order: asNumber(raw.order, 0),
    productIds: uniqueArray(raw.productIds),
  };
}

export async function createUsageArea(raw = {}) {
  const ref = doc(collection(db, "usage_areas"));
  const slug = await ensureUniqueUsageAreaSlug(raw, ref.id);
  const payload = buildUsageAreaPayload({ ...raw, slug });

  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateUsageArea(id, raw = {}) {
  const usageAreaId = cleanText(id);
  if (!usageAreaId) throw new Error("Kullanim alani kimligi gerekli.");

  const current = await getUsageAreaById(usageAreaId);
  if (!current) throw new Error("Kullanim alani bulunamadi.");

  const slug = await ensureUniqueUsageAreaSlug(raw, usageAreaId);
  const payload = buildUsageAreaPayload({ ...current, ...raw, slug });

  await updateDoc(doc(db, "usage_areas", usageAreaId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });

  return usageAreaId;
}

export async function deleteUsageArea(id) {
  const areas = await listUsageAreas({ includeInactive: true });
  if (areas.length <= 1) {
    throw new Error("En az bir kullanim alani kalmali.");
  }

  const current = await getUsageAreaById(id);
  if (!current) throw new Error("Kullanim alani bulunamadi.");

  await deleteDoc(doc(db, "usage_areas", id));
  if (current.imagePath) {
    await removeUsageAreaImage(current.imagePath);
  }
}
