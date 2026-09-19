(function () {
  "use strict";

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action='resume-player']");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (window.PlaylistApp && typeof window.PlaylistApp.resumePlayer === "function") {
      window.PlaylistApp.resumePlayer();
      return;
    }

    var playerScreen = document.getElementById("player-screen");
    var homeScreen = document.getElementById("home-screen");
    var target = document.getElementById("player-target");
    if (playerScreen && target && target.querySelector("iframe")) {
      if (homeScreen) {
        homeScreen.classList.remove("active");
      }
      playerScreen.classList.add("active");
      return;
    }

    var card = document.querySelector(".video-card.primary") || document.querySelector(".video-card[data-action='play-index']");
    if (card) {
      card.click();
    }
  }, true);
})();
