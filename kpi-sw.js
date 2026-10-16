/* KPI Lab, installed from the browser: the offline helper.
   It only looks after the KPI Lab page (its scope) and the files that page uses.
   Pages: try the network first, so a new version shows up; when offline, use the saved copy.
   Styles, scripts, icons: use the saved copy at once and refresh it in the background.
   Nothing you type is ever sent anywhere; this file only stores the app itself.
   Every address is relative to the scope, so the same file works at john.goliash.com/kpi-lab
   and at the root of the kpi-lab repository's own site. */
var CACHE = 'kpi-lab-v1';
var SCOPE = self.registration.scope;                 // the app page itself
var PAGE = SCOPE;
var ASSETS = ['css/style.css', 'css/kpi-lab.css', 'css/kpi-lab-app.css', 'js/kpi-lab.js',
  'img/kpi-lab-192.png', 'img/kpi-lab-512.png', 'img/kpi-lab-maskable-512.png', 'img/kpi-lab-apple-180.png',
  'kpi-lab.webmanifest'].map(function (p) { return new URL(p, SCOPE).pathname; });

/* a response that came through a redirect can't be handed back for a page load, so copy it */
function clean(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then(function (b) { return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }); });
}
function keep(cache, key, res) {
  return clean(res.clone()).then(function (r) { return cache.put(key, r); }).catch(function () {});
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) { return fetch(u).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {}); }))
      .then(function () {
        return fetch(PAGE).then(function (r) { if (r.ok) return keep(c, PAGE, r); })
          .catch(function () {})
          .then(function () { return fetch(new URL('kpi-lab.html', SCOPE)).then(function (r) { if (r.ok) return keep(c, PAGE, r); }).catch(function () {}); });
      });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('kpi-lab-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (r) {
      if (r.ok) caches.open(CACHE).then(function (c) { keep(c, PAGE, r); });
      return clean(r);
    }).catch(function () {
      return caches.match(PAGE).then(function (r) { return r || Response.error(); });
    }));
    return;
  }
  if (ASSETS.indexOf(url.pathname) < 0) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(url.pathname).then(function (hit) {
      var net = fetch(req).then(function (r) { if (r.ok) c.put(url.pathname, r.clone()); return r; }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
