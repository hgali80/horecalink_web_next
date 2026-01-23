//app/sitemap.xml/route.js

export async function GET() {
  const baseUrl = "https://horecalink.kz";
  const now = new Date().toISOString().split("T")[0];

  const pages = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/about", changefreq: "monthly", priority: "0.6" },
    { loc: "/categories", changefreq: "daily", priority: "0.9" },
    { loc: "/contact", changefreq: "monthly", priority: "0.5" },
    { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
    { loc: "/shipping", changefreq: "yearly", priority: "0.3" },
    { loc: "/payment", changefreq: "yearly", priority: "0.3" },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `
  <url>
    <loc>${baseUrl}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
