/* Glasses battery indicator (Battery Status API, navigator.getBattery).
 * Shows "NN%" in the home and player headers: amber at <=20%, red at <=10%,
 * a bolt while charging. If the API is missing, throws, rejects or reports a
 * non-numeric level, the indicator stays hidden: no fake numbers.
 * The indicator lives in the headers, so it fades with video blackout, but a
 * low-battery toast (<=15%, not charging) shows even during blackout, once
 * per threshold crossing (re-armed when charging or back above 15%).
 * window.GlassesBattery.get() feeds the WebMCP player_status tool.
 */
(function () {
  "use strict";

  var AMBER = 20;
  var RED = 10;
  var TOAST_AT = 15;
  var TOAST_MS = 4500;

  var info = { available: false, level: null, charging: null };
  var armed = true;
  var toastTimer = 0;

  function indicators() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-battery]"));
  }

  function hideAll() {
    info = { available: false, level: null, charging: null };
    indicators().forEach(function (el) {
      el.hidden = true;
      el.textContent = "";
    });
  }

  function render() {
    var pct = info.level;
    var cls = pct <= RED ? "battery-critical" : pct <= AMBER ? "battery-low" : "";
    indicators().forEach(function (el) {
      el.hidden = false;
      el.textContent = (info.charging ? "\u26A1\uFE0E" : "") + pct + "%";
      el.classList.toggle("battery-low", cls === "battery-low");
      el.classList.toggle("battery-critical", cls === "battery-critical");
      el.classList.toggle("battery-charging", Boolean(info.charging));
      el.setAttribute("aria-label", "Glasses battery " + pct + " percent" + (info.charging ? ", charging" : ""));
    });
  }

  function lowToast(pct) {
    var toast = document.getElementById("toast");
    if (!toast) {
      return;
    }
    toast.textContent = "Glasses battery low: " + pct + "%";
    toast.classList.add("visible", "toast-urgent");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("toast-urgent", "visible");
    }, TOAST_MS);
  }

  function checkLow() {
    if (info.charging || info.level > TOAST_AT) {
      armed = true;
      return;
    }
    if (armed) {
      armed = false;
      lowToast(info.level);
    }
  }

  function update(battery) {
    var level = Number(battery && battery.level);
    if (!isFinite(level) || level < 0 || level > 1) {
      hideAll();
      return;
    }
    info = {
      available: true,
      level: Math.round(level * 100),
      charging: Boolean(battery.charging)
    };
    render();
    checkLow();
  }

  function start() {
    hideAll();
    var nav = window.navigator;
    if (!nav || typeof nav.getBattery !== "function") {
      return;
    }
    var promise;
    try {
      promise = nav.getBattery();
    } catch (error) {
      return;
    }
    if (!promise || typeof promise.then !== "function") {
      return;
    }
    promise.then(function (battery) {
      if (!battery) {
        hideAll();
        return;
      }
      var onChange = function () {
        try { update(battery); } catch (error) { hideAll(); }
      };
      if (typeof battery.addEventListener === "function") {
        battery.addEventListener("levelchange", onChange);
        battery.addEventListener("chargingchange", onChange);
      }
      onChange();
    }, hideAll);
  }

  window.GlassesBattery = {
    get: function () {
      return { battery_level: info.level, charging: info.charging };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
