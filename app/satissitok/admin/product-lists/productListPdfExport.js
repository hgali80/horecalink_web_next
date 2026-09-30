function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("PDF dosyası okunamadı."));
    reader.readAsDataURL(blob);
  });
}

async function asset(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`PDF kaynağı alınamadı (${response.status}).`);
  return dataUrl(await response.blob());
}

async function smallImage(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Ürün görseli alınamadı.");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally { bitmap.close(); }
}

export async function prepareProductListPdf(form, onProgress) {
  const origin = window.location.origin;
  const budget = AbortSignal.timeout(30000);
  const requiredSignal = AbortSignal.any([budget, AbortSignal.timeout(15000)]);
  const [logoUrl, fontUrl] = await Promise.all([
    asset(new URL("/pdf/horecalink_logo_white_v2.png", origin), requiredSignal),
    asset(new URL("/pdf/NotoSans.ttf", origin), requiredSignal),
  ]);
  const items = form.items.map((item) => ({ ...item, pdfImageUrl: "" }));
  const cache = new Map();
  let next = 0;
  let completed = 0;
  let missingImages = 0;
  async function run() {
    while (next < items.length) {
      const item = items[next++];
      if (item.imageUrl) {
        if (!cache.has(item.imageUrl)) {
          cache.set(item.imageUrl, (async () => {
            try {
              const url = new URL(item.imageUrl, origin);
              const source = url.hostname === "firebasestorage.googleapis.com"
                ? `/api/pdf-image?url=${encodeURIComponent(url.href)}` : url.href;
              return await smallImage(source, AbortSignal.any([budget, AbortSignal.timeout(8000)]));
            } catch { return ""; }
          })());
        }
        item.pdfImageUrl = await cache.get(item.imageUrl);
        if (!item.pdfImageUrl) missingImages++;
      }
      onProgress(`Görseller hazırlanıyor: ${++completed}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, run));
  return { productList: { ...form, items }, logoUrl, fontUrl, missingImages };
}

// PDF layout runs away from the UI thread and can be stopped if it stalls.
export function renderProductListPdf(payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./productListPdf.worker.js", import.meta.url));
    const cleanup = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("PDF hazırlama süresi aşıldı. Listeyi daha küçük bölümlere ayırıp tekrar dene."));
    }, 45000);
    worker.onmessage = ({ data }) => {
      cleanup();
      if (data.error) reject(new Error(data.error));
      else resolve(data.blob);
    };
    worker.onerror = () => { cleanup(); reject(new Error("PDF işlemi başlatılamadı. Sayfayı yenileyip tekrar dene.")); };
    worker.postMessage(payload);
  });
}
