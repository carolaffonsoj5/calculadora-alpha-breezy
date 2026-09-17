/* Alpha Breezy — service worker
   Estrategia:
   - a pagina (index.html): rede primeiro, cache como reserva
     => quando voce atualiza o arquivo no GitHub, o celular pega a versao nova
     assim que tiver internet, sem precisar mexer em nada aqui.
   - o resto (icones, fontes): cache primeiro
     => abre instantaneo e funciona sem sinal. */

var CACHE = 'alpha-breezy-v1';
var BASE = new URL('./', self.location).pathname;
var ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // se um arquivo faltar, nao derruba a instalacao inteira
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  var isPage = req.mode === 'navigate' ||
               (url.origin === self.location.origin &&
                (url.pathname === BASE || /index\.html$/.test(url.pathname)));

  if (isPage) {
    // rede primeiro
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  // cache primeiro (icones, fontes do Google, etc.)
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
