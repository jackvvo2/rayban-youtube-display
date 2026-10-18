/* Video focus mode for the additive Ray-Ban Display.
 * Black pixels are not drawn, so while a video is playing every non-video
 * element fades to pure black (body.video-blackout) and only the video is
 * rendered. Any key / tap wakes the UI; it fades out again after IDLE_MS of
 * no input while the video is still playing. Pause, stop, end, error or
 * leaving the player screen restores the UI.
 * Also owns the persisted video size (percent of full size, centered on black),
 * exposed as window.VideoFocus.setSize for the WebMCP video_size tool.
 */
(function () {
  "use strict";

  var IDLE_MS = 3000;
  var POLL_MS = 300;
  var SIZE_KEY = "rayban-youtube-display:video-size:v1";
  var MIN_SIZE = 20;
  var MAX_SIZE = 100;

  var player = null;
  var lastInput = Date.now();
  var blackout = false;
  var sizePercent = MAX_SIZE;

  // ---- Video size -------------------------------------------------------
  function clampSize(value) {
    return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
  }

  function applySize(percent) {
    sizePercent = clampSize(percent);
    var root = document.documentElement;
    root.style.setProperty("--video-scale", String(sizePercent / 100));
    root.classList.toggle("video-scaled", sizePercent < MAX_SIZE);
    return sizePercent;
  }

  function readSize() {
    try {
      var v = Number(window.localStorage.getItem(SIZE_KEY));
      if (isFinite(v) && v > 0) {
        return v;
      }
    } catch (error) {}
    return MAX_SIZE;
  }

  function setSize(percent) {
    var applied = applySize(percent);
    try {
      window.localStorage.setItem(SIZE_KEY, String(applied));
    } catch (error) {}
    return applied;
  }

  applySize(readSize());

  // ---- Blackout ---------------------------------------------------------
  function playerScreenActive() {
    var screen = document.getElementById("player-screen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function isPlaying() {
    if (!player || typeof player.getPlayerState !== "function") {
      return false;
    }
    try {
      var s = player.getPlayerState();
      // PLAYING (1) or BUFFERING (3); paused/ended/cued/unstarted restore the UI.
      return s === 1 || s === 3;
    } catch (error) {
      return false;
    }
  }

  function isVisibleFocusable(el) {
    if (!el || !el.classList || !el.classList.contains("focusable") || el.disabled) {
      return false;
    }
    if (!playerScreenActive() || !el.closest("#player-screen") || el.closest(".is-hidden")) {
      return false;
    }
    return el.getClientRects().length > 0;
  }

  function ensureFocus() {
    if (!playerScreenActive()) {
      return;
    }
    if (isVisibleFocusable(document.activeElement)) {
      return;
    }
    var toggle = document.getElementById("controls-toggle");
    if (toggle) {
      try { toggle.focus({ preventScroll: true }); } catch (error) { toggle.focus(); }
    }
  }

  function setBlackout(on) {
    on = Boolean(on);
    if (on === blackout) {
      return;
    }
    blackout = on;
    document.body.classList.toggle("video-blackout", on);
    if (!on) {
      ensureFocus();
    }
  }

  function evaluate() {
    var shouldBlack = playerScreenActive() && isPlaying() &&
      document.visibilityState !== "hidden" && Date.now() - lastInput >= IDLE_MS;
    setBlackout(shouldBlack);
  }

  function wake() {
    lastInput = Date.now();
    setBlackout(false);
  }

  // Window capture runs before every document-level key handler (app.js,
  // dpad-cycle.js), so the first press while the UI is black only wakes it
  // and never activates an invisible control.
  window.addEventListener("keydown", function (event) {
    var wasBlack = blackout;
    wake();
    if (wasBlack) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("pointerdown", wake, true);
  window.addEventListener("wheel", wake, { capture: true, passive: true });

  document.addEventListener("playerReady", function (event) {
    var d = event.detail || {};
    if (d.player) {
      player = d.player;
    }
  });

  // Leaving the player restores immediately rather than on the next poll.
  document.addEventListener("click", function (event) {
    var t = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
    if (t && t.dataset.action === "back") {
      window.setTimeout(evaluate, 0);
    }
  });
  document.addEventListener("visibilitychange", evaluate);

  window.setInterval(evaluate, POLL_MS);

  window.VideoFocus = {
    setSize: setSize,
    getSize: function () { return sizePercent; },
    isBlackout: function () { return blackout; },
    wake: wake,
    MIN_SIZE: MIN_SIZE,
    MAX_SIZE: MAX_SIZE,
    IDLE_MS: IDLE_MS
  };
})();
