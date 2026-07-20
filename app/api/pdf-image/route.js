const FIREBASE_STORAGE_HOST = "firebasestorage.googleapis.com";
const PRODUCT_IMAGE_PATH_PREFIX =
  "/v0/b/horecakatalog-e2d10.firebasestorage.app/o/product_images%2F";
const IMAGE_FETCH_TIMEOUT_MS = 15000;

export const runtime = "nodejs";

function isAllowedImageUrl(url) {
  return (
    url.protocol === "https:" &&
    url.hostname === FIREBASE_STORAGE_HOST &&
    url.pathname.startsWith(PRODUCT_IMAGE_PATH_PREFIX)
  );
}

export async function GET(request) {
  const source = new URL(request.url).searchParams.get("url");
  if (!source) {
    return Response.json({ error: "Görsel adresi eksik." }, { status: 400 });
  }

  let imageUrl;
  try {
    imageUrl = new URL(source);
  } catch {
    return Response.json({ error: "Görsel adresi geçersiz." }, { status: 400 });
  }

  if (!isAllowedImageUrl(imageUrl)) {
    return Response.json({ error: "Bu görsel kaynağına izin verilmiyor." }, { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || !contentType.startsWith("image/")) {
      return Response.json({ error: "Görsel alınamadı." }, { status: 502 });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("PDF image proxy error:", error);
    return Response.json({ error: "Görsel alınamadı." }, { status: 502 });
  }
}
