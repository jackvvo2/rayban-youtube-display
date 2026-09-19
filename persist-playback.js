(function () {
  "use strict";

  var STORAGE_KEY = "rayban-youtube-display:watch:v2";
  var MAX_RECENT = 10;
  var player = null;
  var videoId = "";
  var pollTimer = 0;
  var seekTimer = 0;
  var seekTries = 0;

  function readStore() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (data && typeof data === "object") {
        data.times = data.times || {};
        data.recent = Array.isArray(data.recent) ? data.recent : [];
        return data;
      }
    } catch (error) {}
    return { times: {}, recent: [], activeVideoId: "" };
  }

  function writeStore(data) {
    try {
      data.updatedAt = new Date().toISOString();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {}
  }

  function trimRecent(data, id) {
    data.recent = [id].concat(data.recent.filter(function (item) {
      return item && item !== id;
    })).slice(0, MAX_RECENT);
    Object.keys(data.times || {}).forEach(function (key) {
      if (data.recent.indexOf(key) === -1) {
        delete data.times[key];
      }
    });
  }

  function currentTime() {
    if (!player || typeof player.getCurrentTime !== "function") {
      return 0;
    }
    try {
      return Number(player.getCurrentTime()) || 0;
    } catch (error) {
      return 0;
    }
  }

  function duration() {
    if (!player || typeof player.getDuration !== "function") {
      return 0;
    }
    try {
      return Number(player.getDuration()) || 0;
    } catch (error) {
      return 0;
    }
  }

  function persist() {
    if (!videoId) {
      return;
    }
    var time = currentTime();
    var length = duration();
    if (length && time >= length - 2) {
      time = 0;
    }
    if (time < 2 && length === 0) {
      return;
    }
    var data = readStore();
    data.times = data.times || {};
    data.times[videoId] = Math.max(0, Math.floor(time));
    data.activeVideoId = videoId;
    trimRecent(data, videoId);
    writeStore(data);
  }

  function savedTimeFor(id) {
    var data = readStore();
    return data.times && Number(data.times[id]) || 0;
  }

  function resumeIfNeeded() {
    if (!player || !videoId || typeof player.seekTo !== "function") {
      return;
    }
    var target = savedTimeFor(videoId);
    var length = duration();
    var now = currentTime();
    if (!target || target < 3) {
      return;
    }
    if (length && target >= length - 5) {
      return;
    }
    if (now >= target - 1 && now <= target + 4) {
      return;
    }
    if (now > 8 && Math.abs(now - target) > 8) {
      try {
        player.seekTo(target, true);
      } catch (error) {}
      return;
    }
    try {
      player.seekTo(target, true);
    } catch (error) {}
  }

  function startSeekAttempts() {
    window.clearInterval(seekTimer);
    seekTries = 0;
    seekTimer = window.setInterval(function () {
      seekTries += 1;
      resumeIfNeeded();
      if (seekTries >= 8) {
        window.clearInterval(seekTimer);
      }
    }, 500);
  }

  function startPoll() {
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(persist, 1500);
  }

  function bindPlayer(nextPlayer, nextVideoId) {
    if (videoId && nextVideoId && nextVideoId !== videoId) {
      persist();
    }
    if (!nextPlayer) {
      return;
    }
    player = nextPlayer;
    if (nextVideoId) {
      videoId = nextVideoId;
    }
    startPoll();
    startSeekAttempts();
  }

  document.addEventListener("playerReady", function (event) {
    var detail = event.detail || {};
    bindPlayer(detail.player, detail.videoId);
  });

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    var action = target.dataset.action;
    if (action === "play-index" || action === "next-video" || action === "previous-video") {
      persist();
    }
  }, true);

  document.addEventListener("visibilitychange", persist);
  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);
})();
