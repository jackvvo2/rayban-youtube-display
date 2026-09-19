(function () {
  "use strict";

  function playerScreenActive() {
    var screen = document.getElementById("player-screen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function lockIframes() {
    var nodes = document.querySelectorAll("#player-target, #player-target iframe, .player-shell iframe");
    Array.prototype.forEach.call(nodes, function (node) {
      node.setAttribute("tabindex", "-1");
      node.setAttribute("aria-hidden", "true");
    });
  }

  function focusAppControls() {
    if (!playerScreenActive()) {
      return;
    }
    lockIframes();
    var drawer = document.getElementById("player-controls");
    var play = document.getElementById("play-toggle");
    var toggle = document.getElementById("controls-toggle");
    var target = toggle;
    if (drawer && !drawer.classList.contains("is-hidden") && play) {
      target = play;
    }
    if (!target) {
      return;
    }
    try {
      target.focus({ preventScroll: true });
    } catch (error) {
      target.focus();
    }
  }

  function activeIsIframe() {
    var el = document.activeElement;
    if (!el) {
      return true;
    }
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "iframe" || tag === "body" || tag === "html") {
      return true;
    }
    if (el.id === "player-target") {
      return true;
    }
    return false;
  }

  function recover() {
    if (!playerScreenActive()) {
      return;
    }
    if (activeIsIframe() || !document.activeElement || !document.activeElement.classList || !document.activeElement.classList.contains("focusable")) {
      focusAppControls();
    }
  }

  document.addEventListener("focusin", function (event) {
    var target = event.target;
    if (!target) {
      return;
    }
    var tag = String(target.tagName || "").toLowerCase();
    if (tag === "iframe" || target.id === "player-target") {
      event.preventDefault();
      window.setTimeout(focusAppControls, 0);
    }
  }, true);

  window.addEventListener("focus", function () {
    window.setTimeout(recover, 50);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      window.setTimeout(recover, 80);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (!playerScreenActive()) {
      return;
    }
    var keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Escape", "Backspace"];
    if (keys.indexOf(event.key) === -1) {
      return;
    }
    if (activeIsIframe()) {
      focusAppControls();
    }
  }, true);

  window.setInterval(function () {
    if (playerScreenActive() && activeIsIframe()) {
      focusAppControls();
    }
    lockIframes();
  }, 1500);

  var shell = document.getElementById("player-shell") || document.querySelector(".player-shell");
  if (shell && typeof MutationObserver === "function") {
    new MutationObserver(lockIframes).observe(shell, { childList: true, subtree: true });
  }
})();
