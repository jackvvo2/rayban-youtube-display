(function () {
  "use strict";

  function listEl() {
    return document.getElementById("playlist-list");
  }

  function scrollToCard(card) {
    var list = listEl();
    if (!list || !card || !list.contains(card)) {
      return;
    }
    var listRect = list.getBoundingClientRect();
    var cardRect = card.getBoundingClientRect();
    var pad = 8;
    if (cardRect.bottom > listRect.bottom - pad) {
      list.scrollTop += Math.ceil(cardRect.bottom - listRect.bottom + pad);
    } else if (cardRect.top < listRect.top + pad) {
      list.scrollTop -= Math.ceil(listRect.top - cardRect.top + pad);
    }
  }

  document.addEventListener("focusin", function (event) {
    var card = event.target && event.target.closest ? event.target.closest("#playlist-list .focusable") : null;
    if (card) {
      window.setTimeout(function () {
        scrollToCard(card);
      }, 0);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    var home = document.getElementById("home-screen");
    if (!home || !home.classList.contains("active")) {
      return;
    }
    window.setTimeout(function () {
      var active = document.activeElement;
      if (active && active.closest && active.closest("#playlist-list")) {
        scrollToCard(active);
      }
    }, 0);
  });
})();
