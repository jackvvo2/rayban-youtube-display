(function () {
  "use strict";

  function visibleScreen() {
    return document.querySelector(".screen.active") || document.getElementById("player-screen");
  }

  function focusables() {
    var screen = visibleScreen();
    if (!screen) {
      return [];
    }
    return Array.prototype.slice.call(screen.querySelectorAll(".focusable")).filter(function (el) {
      if (el.disabled) {
        return false;
      }
      var parent = el.closest(".is-hidden");
      if (parent) {
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
  }

  document.addEventListener("keydown", function (event) {
    if (event.key.indexOf("Arrow") !== 0) {
      return;
    }
    var list = focusables();
    if (list.length < 2) {
      return;
    }
    var current = document.activeElement;
    var index = list.indexOf(current);
    if (index === -1) {
      event.preventDefault();
      event.stopImmediatePropagation();
      focusEl(list[0]);
      return;
    }
    var backwards = event.key === "ArrowLeft" || event.key === "ArrowUp";
    var next = backwards ? index - 1 : index + 1;
    if (next < 0) {
      next = list.length - 1;
    }
    if (next >= list.length) {
      next = 0;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    focusEl(list[next]);
  }, true);
})();
