(function () {
  "use strict";

  function hasVideoFrame() {
    var target = document.getElementById("player-target");
    if (!target) {
      return false;
    }
    if (String(target.tagName).toLowerCase() === "iframe") {
      return true;
    }
    return Boolean(target.querySelector("iframe"));
  }

  function showPlayerScreen() {
    var playerScreen = document.getElementById("player-screen");
    var homeScreen = document.getElementById("home-screen");
    if (!playerScreen) {
      return false;
    }
    if (homeScreen) {
      homeScreen.classList.remove("active");
    }
    playerScreen.classList.add("active");
    return true;
  }

  function showHomeScreen() {
    var playerScreen = document.getElementById("player-screen");
    var homeScreen = document.getElementById("home-screen");
    if (playerScreen) {
      playerScreen.classList.remove("active");
    }
    if (homeScreen) {
      homeScreen.classList.add("active");
    }
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action='resume-player']");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    if (hasVideoFrame()) {
      showPlayerScreen();
      return;
    }

    if (window.PlaylistApp && typeof window.PlaylistApp.resumePlayer === "function") {
      window.PlaylistApp.resumePlayer();
      return;
    }

    var card = document.querySelector(".video-card.primary") || document.querySelector(".video-card[data-action='play-index']");
    if (card) {
      card.click();
    }
  }, true);

  document.addEventListener("click", function (event) {
    var back = event.target.closest("[data-action='back']");
    if (!back) {
      return;
    }
    var playerScreen = document.getElementById("player-screen");
    if (playerScreen && playerScreen.classList.contains("active")) {
      showHomeScreen();
    }
  }, true);
})();
