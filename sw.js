const CACHE_NAME = "projeto-natan-v3-1-cache-1";
const ASSETS = ["./","./index.html","./css/global.css","./css/components.css","./css/v3-pro.css","./js/app.js","./js/api.js","./js/storage.js","./js/ui.js","./js/auth.js","./js/operator.js","./js/manager.js","./js/admin.js","./js/qr.js","./manifest.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  const url = new URL(e.request.url);
  if(e.request.method !== "GET") return;
  if(url.pathname.includes("/macros/s/")) return;
  e.respondWith(caches.match(e.request).then(cached=>cached || fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match("./index.html"))));
});
