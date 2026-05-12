const CACHE_NAME = "projeto-natan-v3-35-4-hotfix-lixeira-load-final";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/global.css",
  "./css/components.css",
  "./css/factory-cleanroom-global-v3.css",
  "./css/final-pro-layout-v35.css",
  "./js/app.js",
  "./js/api.js",
  "./js/auth.js",
  "./js/operator.js",
  "./js/manager.js",
  "./js/admin.js",
  "./js/qr.js",
  "./js/ui.js",
  "./js/storage.js",
  "./js/core/cacheManager.js",
  "./js/core/managerPermissions.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(CORE_ASSETS))
      .catch(()=>{})
  );
});

self.addEventListener("activate", event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k !== CACHE_NAME).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", event=>{
  const req = event.request;
  const url = new URL(req.url);

  if(req.method !== "GET") return;
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached=>{
      const network = fetch(req)
        .then(res=>{
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(req, copy)).catch(()=>{});
          return res;
        })
        .catch(()=>cached);

      return cached || network;
    })
  );
});
