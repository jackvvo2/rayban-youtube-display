var CACHE = "rayban-youtube-display-v8.6";
var URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./chapters.js",
  "./resume-player.js",
  "./persist-playback.js",
  "./play-toggle-fix.js",
  "./focus-restore.js",
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

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
