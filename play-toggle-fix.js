(function () {
  "use strict";

  var player = null;

  document.addEventListener("playerReady", function (event) {
    var detail = event.detail || {};
    if (detail.player) {
      player = detail.player;
    }
  });

  function liveState() {
    if (!player || typeof player.getPlayerState !== "function") {
      return null;
    }
    try {
      return player.getPlayerState();
    } catch (error) {
      return null;
    }
  }

  function playNow() {
    if (!player || typeof player.playVideo !== "function") {
      return false;
    }
    try {
      player.playVideo();
      return true;
    } catch (error) {
      return false;
    }
  }

  function pauseNow() {
    if (!player || typeof player.pauseVideo !== "function") {
      return;
    }
    try {
      player.pauseVideo();
    } catch (error) {}
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action='player-toggle']");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    var ytState = liveState();
    var playing = ytState === 1 || ytState === 3;
    if (playing) {
      pauseNow();
      return;
    }
    playNow();
    window.setTimeout(function () {
      var again = liveState();
      if (again !== 1 && again !== 3) {
        playNow();
      }
    }, 250);
  }, true);
})();
