/* StudentPP service worker: offline shell, never touches the prediction API */
var CACHE = "studentpp-v2";
var SHELL = ["/", "/predict", "/quiz", "/focus", "/how-it-works", "/improve", "/about", "/style.css",
  "/favicon.svg", "/icon-192.png", "/icon-512.png", "/manifest.json"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  // only same-origin GET: prediction API, CDN scripts and fonts go straight to the network
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || /^\/googled/.test(url.pathname)) return;

  if (req.mode === "navigate") {
    // pages: network first (always fresh), cached copy when offline
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      if (res.ok) caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match("/"); });
    }));
    return;
  }
  // static files: cached copy first, refreshed in the background
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
