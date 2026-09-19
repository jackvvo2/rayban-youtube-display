(function () {
  "use strict";

  function formatVersion(cacheName) {
    var match = String(cacheName || "").match(/v(\d+(?:\.\d+)*)/i);
    return match ? "V" + match[1] : "";
  }

  function setVersionLabel(cacheName) {
    var label = document.getElementById("app-version-label");
    if (!label) {
      return;
    }
    var version = formatVersion(cacheName);
    label.textContent = version ? "Meta Display - " + version : "Meta Display";
  }

  function askServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return Promise.reject(new Error("no sw"));
    }
    return navigator.serviceWorker.ready.then(function (reg) {
      var worker = navigator.serviceWorker.controller || (reg && (reg.active || reg.waiting || reg.installing));
      if (!worker) {
        throw new Error("no worker");
      }
      return new Promise(function (resolve, reject) {
        var channel = new MessageChannel();
        var timer = window.setTimeout(function () {
          reject(new Error("timeout"));
        }, 1500);
        channel.port1.onmessage = function (event) {
          window.clearTimeout(timer);
          var cacheName = event.data && (event.data.cache || event.data.version);
          if (cacheName) {
            resolve(cacheName);
            return;
          }
          reject(new Error("empty"));
        };
        worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
      });
    });
  }

  function readServiceWorkerFile() {
    return fetch("service-worker.js", { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("sw file");
      }
      return response.text();
    }).then(function (text) {
      var match = text.match(/CACHE\s*=\s*["']([^"']+)["']/);
      if (!match) {
        throw new Error("no cache");
      }
      return match[1];
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (event) {
      var cacheName = event.data && (event.data.cache || event.data.version);
      if (cacheName) {
        setVersionLabel(cacheName);
      }
    });
  }

  askServiceWorker().then(setVersionLabel).catch(function () {
    return readServiceWorkerFile().then(setVersionLabel);
  }).catch(function () {});
})();
