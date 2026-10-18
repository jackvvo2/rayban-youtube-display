var CACHE = "rayban-youtube-display-v9.8";
var URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./playlist-scroll.css",
  "./video-focus.css",
  "./battery.css",
  "./app.js",
  "./chapters.js",
  "./resume-player.js",
  "./persist-playback.js",
  "./play-toggle-fix.js",
  "./dpad-cycle.js",
  "./playlist-scroll.js",
  "./focus-restore.js",
  "./video-focus.js",
  "./battery.js",
  "./captions.js",
  "./webmcp.js",
  "./version-label.js",
  "./playlist.json",
  "./manifest.webmanifest",
  "./favicon.png"
];

function postVersion(client) {
  if (client && typeof client.postMessage === "function") {
    client.postMessage({ type: "APP_VERSION", cache: CACHE });
  }
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) {
          return caches.delete(key);
        }
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      return self.clients.matchAll({ type: "window" });
    }).then(function (clients) {
      clients.forEach(postVersion);
    })
  );
});

self.addEventListener("message", function (event) {
  if (!event.data || event.data.type !== "GET_VERSION") {
    return;
  }
  var payload = { type: "APP_VERSION", cache: CACHE };
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage(payload);
    return;
  }
  if (event.source) {
    event.source.postMessage(payload);
  }
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for page navigations so a new deploy (e.g. new scripts in
  // index.html) is picked up on the first launch; cache-first for the rest.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("./index.html");
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
