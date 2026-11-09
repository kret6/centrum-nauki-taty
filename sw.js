// Tryb offline: pliki są od razu brane z pamięci urządzenia, a w tle odświeżane z sieci.
var CACHE = 'centrum-taty-f8b473f49e0e';
var PLIKI = ["./","./index.html","./BA/index.html","./BA/kurs.js","./BA/silnik.js","./BA/tresc.szyfr.js","./IAM/index.html","./IAM/kurs.js","./IAM/silnik.js","./IAM/tresc.szyfr.js","./Niemiecki/index.html","./Niemiecki/kurs.js","./Niemiecki/silnik.js","./Niemiecki/tresc.szyfr.js","./SQL/index.html","./SQL/kurs.js","./SQL/silnik.js","./SQL/tresc.szyfr.js","./SQL/vendor/LICENSE.sql.js.txt","./SQL/vendor/sql-wasm-binarka.js","./SQL/vendor/sql-wasm.js","./ikona.svg","./manifest.json","./SQL/","./Niemiecki/","./IAM/","./BA/"];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(PLIKI.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (n) {
    return Promise.all(n.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (zPamieci) {
      var zSieci = fetch(e.request).then(function (o) {
        if (o.ok) c.put(e.request, o.clone());
        return o;
      });
      if (zPamieci) { zSieci.catch(function () {}); return zPamieci; }
      return zSieci;
    });
  }));
});
