// app/robots.txt/route.js

export async function GET() {
  const content = `
User-agent: *
Allow: /

Sitemap: https://horecalink.kz/sitemap.xml
Sitemap: https://horecalink.kz/sitemap-products.xml
`.trim();

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
