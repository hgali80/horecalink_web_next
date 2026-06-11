import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../../../firebase";
import { getAdminServices } from "./firebaseAdmin";
import { getBaseUrl as getConfiguredBaseUrl } from "./siteConfig";

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;

  const normalized = cleanText(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  return fallback;
}

function toIsoDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  if (typeof value === "object") {
    const seconds = Number(value.seconds);
    const nanoseconds = Number(value.nanoseconds || 0);

    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000 + nanoseconds / 1e6).toISOString();
    }
  }

  return null;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    "<url>",
    `<loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : "",
    changefreq ? `<changefreq>${xmlEscape(changefreq)}</changefreq>` : "",
    typeof priority === "number" ? `<priority>${priority.toFixed(1)}</priority>` : "",
    "</url>",
  ]
    .filter(Boolean)
    .join("");
}

function buildSitemapEntry({ loc, lastmod }) {
  return [
    "<sitemap>",
    `<loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : "",
    "</sitemap>",
  ]
    .filter(Boolean)
    .join("");
}

function xmlResponse(body) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export function getBaseUrl() {
  return getConfiguredBaseUrl();
}

export function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

export async function getPublishedProductsForSitemap() {
  let docs = [];

  try {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb
      .collection("products")
      .where("active", "==", true)
      .where("webPublished", "==", true)
      .get();

    docs = snapshot.docs;
  } catch {
    const snapshot = await getDocs(
      query(
        collection(db, "products"),
        where("active", "==", true),
        where("webPublished", "==", true)
      )
    );

    docs = snapshot.docs;
  }

  return docs
    .map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        slug: cleanText(data.slug) || doc.id,
        groupKey: cleanText(data.groupKey || data.group),
        categoryKey: cleanText(data.categoryKey || data.main_category || data.category),
        subcategoryKey: cleanText(
          data.subcategoryKey || data.sub_category || data.subcategory
        ),
        updatedAt:
          toIsoDate(data.updatedAt) ||
          toIsoDate(data.importedAt) ||
          toIsoDate(data.createdAt),
        active: normalizeBoolean(data.active, true),
        webPublished: normalizeBoolean(data.webPublished, true),
      };
    })
    .filter((product) => product.active && product.webPublished && product.slug);
}

export function createUrlsetResponse(entries) {
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("")}
</urlset>`);
}

export function createSitemapIndexResponse(entries) {
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("")}
</sitemapindex>`);
}

export { buildSitemapEntry, buildUrlEntry };
