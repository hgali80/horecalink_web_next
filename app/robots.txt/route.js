import { getBaseUrl } from "../lib/server/siteConfig";

export async function GET() {
  const baseUrl = getBaseUrl();

  const content = `
User-agent: *
Allow: /
Disallow: /satissitok/
Disallow: /api/
Disallow: /login
Disallow: /forgot-password

Host: ${baseUrl.replace(/^https?:\/\//, "")}
Sitemap: ${baseUrl}/sitemap.xml
`.trim();

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
