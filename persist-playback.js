(function () {
  "use strict";

  var STORAGE_KEY = "rayban-youtube-display:watch:v2";
  var MAX_RECENT = 10;
  var player = null;
  var videoId = "";
  var pollTimer = 0;
  var skipResume = false;
  var resumedFor = "";

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
    if (!videoId || skipResume) {
      return;
    }
    var time = currentTime();
    var length = duration();
    if (!time) {
      return;
    }
    if (length && time >= length - 2) {
      time = 0;
    }
    var data = readStore();
    data.times = data.times || {};
    data.times[videoId] = Math.max(0, Math.floor(time));
    data.activeVideoId = videoId;
    trimRecent(data, videoId);
    writeStore(data);
  }

  function clearSavedTime(id) {
    var data = readStore();
    if (data.times) {
      delete data.times[id];
    }
    writeStore(data);
  }

  function savedTimeFor(id) {
    var data = readStore();
    return data.times && Number(data.times[id]) || 0;
  }

  function resumeOnce() {
    if (skipResume || !player || !videoId || resumedFor === videoId) {
      return;
    }
    if (typeof player.seekTo !== "function") {
      return;
    }
    var target = savedTimeFor(videoId);
    var now = currentTime();
    var length = duration();
    if (!target || target < 5) {
      resumedFor = videoId;
      return;
    }
    if (length && target >= length - 5) {
      resumedFor = videoId;
      return;
    }
    if (now >= 8) {
      resumedFor = videoId;
      return;
    }
    try {
      player.seekTo(target, true);
    } catch (error) {}
    resumedFor = videoId;
  }

  function startFromBeginning() {
    skipResume = true;
    resumedFor = videoId;
    if (videoId) {
      clearSavedTime(videoId);
    }
    if (player && typeof player.seekTo === "function") {
      try {
        player.seekTo(0, true);
      } catch (error) {}
      try {
        if (typeof player.playVideo === "function") {
          player.playVideo();
        }
      } catch (error) {}
    }
    var status = document.getElementById("player-status");
    if (status) {
      status.textContent = "Playing from the beginning.";
    }
    window.setTimeout(function () {
      skipResume = false;
    }, 2000);
  }

  function startPoll() {
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(persist, 4000);
  }

  function bindPlayer(nextPlayer, nextVideoId) {
    if (videoId && nextVideoId && nextVideoId !== videoId) {
      persist();
      skipResume = false;
      resumedFor = "";
    }
    if (!nextPlayer) {
      return;
    }
    player = nextPlayer;
    if (nextVideoId) {
      videoId = nextVideoId;
    }
    startPoll();
    window.setTimeout(resumeOnce, 1200);
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
    if (action === "restart-video") {
      event.preventDefault();
      event.stopImmediatePropagation();
      startFromBeginning();
      return;
    }
    if (action === "play-index" || action === "next-video" || action === "previous-video") {
      persist();
    }
  }, true);

  document.addEventListener("visibilitychange", persist);
  window.addEventListener("pagehide", persist);
})();
