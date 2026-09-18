(function () {
  "use strict";

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action='resume-player']");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    var card = document.querySelector(".video-card.primary") || document.querySelector(".video-card[data-action='play-index']");
    if (!card) {
      var toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = "No video to open yet";
        toast.classList.add("visible");
        window.setTimeout(function () {
          toast.classList.remove("visible");
        }, 3000);
      }
      return;
    }
    card.click();
  }, true);
})();
