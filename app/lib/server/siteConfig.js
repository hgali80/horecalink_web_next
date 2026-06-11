const DEFAULT_SITE_URL = "https://horecalink.kz";

function normalizeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return DEFAULT_SITE_URL;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getBaseUrl() {
  return normalizeUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL
  );
}

export function getGoogleSiteVerification() {
  return String(
    process.env.GOOGLE_SITE_VERIFICATION ||
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
      ""
  ).trim();
}
