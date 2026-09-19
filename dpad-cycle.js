(function () {
  "use strict";

  function playerScreenActive() {
    var screen = document.getElementById("player-screen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function focusables() {
    var screen = document.getElementById("player-screen");
    if (!screen) {
      return [];
    }
    return Array.prototype.slice.call(screen.querySelectorAll(".focusable")).filter(function (el) {
      if (el.disabled) {
        return false;
      }
      if (el.closest(".is-hidden")) {
        return false;
      }
      var style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return el.getClientRects().length > 0;
    });
  }

  function focusEl(el) {
    if (!el) {
      return;
    }
    try {
      el.focus({ preventScroll: true });
    } catch (error) {
      el.focus();
    }
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  document.addEventListener("keydown", function (event) {
    if (event.key.indexOf("Arrow") !== 0) {
      return;
    }
    if (!playerScreenActive()) {
      return;
    }
    var list = focusables();
    if (list.length < 2) {
      return;
    }
    var current = document.activeElement;
    var index = list.indexOf(current);
    var backwards = event.key === "ArrowLeft" || event.key === "ArrowUp";
    var next;
    if (index === -1) {
      next = 0;
    } else {
      next = backwards ? index - 1 : index + 1;
      if (next < 0) {
        next = list.length - 1;
      }
      if (next >= list.length) {
        next = 0;
      }
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    focusEl(list[next]);
  }, true);
})();
