const cacheName = 'quiet-morning-development';
const staticFiles = ['./','./?mode=owner','./index.html','./style.css','./app.js','./api.js','./calc.js','./config.js','./manifest.webmanifest','./owner.webmanifest','./img/sun.svg','./img/icon-192.png','./img/icon-512.png','./img/hero.webp','./img/satin.webp','./img/poplin.webp','./img/calico.webp','./assortment.js','./storefront.js','./img/category-bedding.webp','./img/category-towels.webp','./img/category-child.webp' /* category routes */];
const allow = new Set(staticFiles.map(path => new URL(path,self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(staticFiles)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('quiet-morning-')&&key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  url.hash='';
  if(!allow.has(url.href))return;
  event.respondWith(fetch(event.request,{cache:'no-cache'}).catch(async()=> (await caches.open(cacheName)).match(url.href)));
});
