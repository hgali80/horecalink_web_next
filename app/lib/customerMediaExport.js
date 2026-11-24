const DEFAULT_IMAGE_TIMEOUT_MS = 5_000;
const DEFAULT_IMAGE_CONCURRENCY = 8;

async function loadImageDataUrl(source, timeoutMs) {
  const url = new URL(source, window.location.origin);
  if (!["http:", "https:", "data:", "blob:"].includes(url.protocol)) {
    throw new Error("Unsupported image URL");
  }

  const requestUrl = url.hostname === "firebasestorage.googleapis.com"
    ? `/api/pdf-image?url=${encodeURIComponent(url.href)}`
    : url.href;
  const response = await fetch(requestUrl, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);

  const bitmap = await createImageBitmap(await response.blob());
  try {
    // Normalize large and modern image formats to an Excel/PDF-friendly thumbnail.
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

export async function loadCustomerExportImages(sources, {
  concurrency = DEFAULT_IMAGE_CONCURRENCY,
  timeoutMs = DEFAULT_IMAGE_TIMEOUT_MS,
} = {}) {
  const uniqueSources = [...new Set(sources.map((source) => String(source || "").trim()).filter(Boolean))];
  const images = new Map();
  let next = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueSources.length) }, async () => {
    while (next < uniqueSources.length) {
      const source = uniqueSources[next++];
      try {
        images.set(source, await loadImageDataUrl(source, timeoutMs));
      } catch {
        // Exports remain usable when a catalog image is unavailable or slow.
        images.set(source, null);
      }
    }
  }));

  return images;
}
