(function () {
  "use strict";

  var STORAGE_KEY = "rayban-youtube-display:watch:v1";
  var player = null;
  var videoId = "";
  var pollTimer = 0;
  var resumeDone = {};

  function readStore() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { times: {}, activeVideoId: "" };
    } catch (error) {
      return { times: {}, activeVideoId: "" };
    }
  }

  function writeStore(data) {
    try {
      data.updatedAt = new Date().toISOString();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {}
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
    var data = readStore();
    data.times = data.times || {};
    data.times[videoId] = Math.max(0, Math.floor(time));
    data.activeVideoId = videoId;
    writeStore(data);
  }

  function resumeIfNeeded() {
    if (!player || !videoId || resumeDone[videoId]) {
      return;
    }
    var data = readStore();
    var time = data.times && Number(data.times[videoId]);
    var length = duration();
    if (!time || time < 3) {
      resumeDone[videoId] = true;
      return;
    }
    if (length && time >= length - 5) {
      resumeDone[videoId] = true;
      return;
    }
    try {
      player.seekTo(time, true);
      resumeDone[videoId] = true;
    } catch (error) {}
  }

  function startPoll() {
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(persist, 2000);
  }

  function bindPlayer(nextPlayer, nextVideoId) {
    if (!nextPlayer) {
      return;
    }
    player = nextPlayer;
    if (nextVideoId) {
      videoId = nextVideoId;
    }
    startPoll();
    window.setTimeout(resumeIfNeeded, 400);
  }

  document.addEventListener("playerReady", function (event) {
    var detail = event.detail || {};
    bindPlayer(detail.player, detail.videoId);
  });

  document.addEventListener("visibilitychange", function () {
    persist();
  });

  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);
})();
