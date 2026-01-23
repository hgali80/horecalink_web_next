//app/sitemap-products.xml/route.js
import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  const baseUrl = "https://horecalink.kz";

  const snap = await getDocs(collection(db, "products"));

  const urls = snap.docs.map((doc) => {
    return `
  <url>
    <loc>${baseUrl}/products/${doc.id}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
