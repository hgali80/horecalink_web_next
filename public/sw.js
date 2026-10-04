/* Only cache the offline screen. Live catalogue, API and account data stay on the network. */
const OFFLINE_CACHE = "horecalink-offline-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add("/offline.html")));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("horecalink-offline-") && key !== OFFLINE_CACHE)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () =>
    (await caches.match("/offline.html", { cacheName: OFFLINE_CACHE })) || Response.error()));
});
