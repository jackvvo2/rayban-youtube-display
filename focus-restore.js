(function () {
  "use strict";

  function playerScreenActive() {
    var screen = document.getElementById("player-screen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function lockIframes() {
    var nodes = document.querySelectorAll("#player-target, .player-shell iframe");
    Array.prototype.forEach.call(nodes, function (node) {
      node.setAttribute("tabindex", "-1");
    });
  }

  function focusControlsIfLost() {
    if (!playerScreenActive()) {
      return;
    }
    var active = document.activeElement;
    if (active && active.classList && active.classList.contains("focusable")) {
      return;
    }
    var toggle = document.getElementById("controls-toggle");
    if (!toggle) {
      return;
    }
    try {
      toggle.focus({ preventScroll: true });
    } catch (error) {
      toggle.focus();
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      lockIframes();
      window.setTimeout(focusControlsIfLost, 200);
    }
  });

  window.addEventListener("pageshow", function () {
    lockIframes();
    window.setTimeout(focusControlsIfLost, 200);
  });
})();
