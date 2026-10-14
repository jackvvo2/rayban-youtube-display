/* WebMCP tools for Meta Ray-Ban Display (document.modelContext).
 * Feature-detected: no-op when document.modelContext is absent.
 * Drives the existing UI by clicking [data-action] buttons so app.js and the
 * add-on scripts (persist-playback, chapters, play-toggle-fix) stay the single
 * source of truth. Not yet included in index.html.
 * Docs: https://wearables.developer.meta.com/docs/develop/webapps/agent-tools/
 */
(function () {
  "use strict";

  var mc = document.modelContext;
  if (!mc || typeof mc.registerTool !== "function") {
    return;
  }

  var player = null;
  var currentVideoId = "";
  document.addEventListener("playerReady", function (event) {
    var d = event.detail || {};
    if (d.player) { player = d.player; }
    if (d.videoId) { currentVideoId = d.videoId; }
  });

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function clickAction(action, extraSelector) {
    var el = document.querySelector('[data-action="' + action + '"]' + (extraSelector || ""));
    if (!el) { return false; }
    el.click();
    return true;
  }

  function cards() {
    return Array.prototype.slice.call(document.querySelectorAll('#playlist-list [data-action="play-index"]'));
  }

  function cardTitle(card) {
    var t = card.querySelector(".label");
    return (t ? t.textContent : card.textContent || "").trim();
  }

  function playerInfo() {
    var info = { screen: document.querySelector(".screen.active") ? document.querySelector(".screen.active").id : "" };
    info.position = (document.getElementById("player-eyebrow") || {}).textContent || "";
    info.title = (document.getElementById("video-title") || {}).textContent || "";
    if (player) {
      try {
        var YT = window.YT || {}; var ps = YT.PlayerState || {};
        var s = player.getPlayerState();
        info.state = s === ps.PLAYING ? "playing" : s === ps.PAUSED ? "paused" : s === ps.ENDED ? "ended" : "other";
        info.time_seconds = Math.round(player.getCurrentTime() || 0);
        info.duration_seconds = Math.round(player.getDuration() || 0);
      } catch (e) { /* fallback iframe has no API */ }
    }
    if (window.ChapterManager) {
      var ch = window.ChapterManager.getCurrentChapter();
      if (ch) { info.chapter = ch.title; }
    }
    return info;
  }

  async function settle(result) {
    await wait(700);
    result.now = playerInfo();
    return result;
  }

  function register(def) {
    try {
      mc.registerTool(def).catch(function () {});
    } catch (e) { /* sync TypeError */ }
  }

  register({
    name: "playlist_list",
    description: "List the videos in the playlist with their 1-based number and title. Use before play_video when the user names a video.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: { type: "object", properties: {} },
    async execute() {
      var list = cards().map(function (c, i) { return { number: i + 1, title: cardTitle(c).slice(0, 120) }; });
      if (!list.length) { return { error: "empty", message: "Playlist is not loaded yet.", next_action: "Call playlist_refresh, then try again." }; }
      return { count: list.length, videos: list, next_action: "Stop and talk, or call play_video with a number." };
    }
  });

  register({
    name: "play_video",
    description: "Start a playlist video. Pass number (1-based position from playlist_list) or query (words from the title). Returns what is now playing.",
    annotations: { untrustedContentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "number", description: "1-based position in the playlist." },
        query: { type: "string", description: "Words that appear in the video title." }
      }
    },
    async execute(input) {
      input = input || {};
      var list = cards();
      var idx = -1;
      var n = Number(input.number);
      if (Number.isInteger(n) && n >= 1 && n <= list.length) {
        idx = n - 1;
      } else if (typeof input.query === "string" && input.query.trim()) {
        var words = input.query.toLowerCase().split(/\s+/).filter(Boolean);
        var best = 0;
        list.forEach(function (c, i) {
          var t = cardTitle(c).toLowerCase();
          var score = words.filter(function (w) { return t.indexOf(w) !== -1; }).length;
          if (score > best) { best = score; idx = i; }
        });
      }
      if (idx < 0) { return { error: "not_found", message: "No matching video.", next_action: "Call playlist_list and ask the user which one." }; }
      list[idx].click();
      return settle({ started: idx + 1 });
    }
  });

  register({
    name: "playback_control",
    description: "Control the player. action is one of: toggle (play/pause), next, previous, skip30, restart, next_chapter, previous_chapter, last_chapter.",
    inputSchema: {
      type: "object",
      properties: { action: { type: "string", description: "toggle | next | previous | skip30 | restart | next_chapter | previous_chapter | last_chapter" } },
      required: ["action"]
    },
    async execute(input) {
      var map = {
        toggle: "player-toggle", next: "next-video", previous: "previous-video",
        skip30: "skip-30", restart: "restart-video", last_chapter: "last-chapter",
        next_chapter: "next-chapter", previous_chapter: "previous-chapter"
      };
      var a = input && map[String(input.action || "").toLowerCase()];
      if (!a) { return { error: "bad_action", message: "Unknown action.", next_action: "Retry with one of the listed actions." }; }
      if (a === "next-chapter" || a === "previous-chapter") {
        // No buttons exist for these; call ChapterManager directly.
        var cm = window.ChapterManager;
        if (!cm) { return { error: "unavailable", message: "Chapters unavailable." }; }
        var ch = a === "next-chapter" ? cm.getNextChapter() : cm.getPreviousChapter();
        if (!ch) { return settle({ error: "no_chapter", message: "No chapter in that direction." }); }
        cm.seekToChapter(ch);
        return settle({ done: input.action, chapter: ch.title });
      }
      if (!clickAction(a)) { return { error: "unavailable", message: "That control is not available right now." }; }
      return settle({ done: input.action });
    }
  });

  register({
    name: "seek_to",
    description: "Jump to a time in the current video, in seconds from the start.",
    inputSchema: { type: "object", properties: { seconds: { type: "number", description: "Target time in seconds." } }, required: ["seconds"] },
    async execute(input) {
      var s = Number(input && input.seconds);
      if (!isFinite(s) || s < 0) { return { error: "bad_time", message: "Seconds must be zero or more." }; }
      if (!player || typeof player.seekTo !== "function") { return { error: "no_player", message: "No video is playing.", next_action: "Call play_video first." }; }
      player.seekTo(s, true);
      return settle({ seeked_to: s });
    }
  });

  register({
    name: "player_status",
    description: "Report what is on screen: current video, play state, time, and chapter.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: { type: "object", properties: {} },
    async execute() { return playerInfo(); }
  });

  register({
    name: "playlist_refresh",
    description: "Reload the playlist from the server.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      clickAction("refresh-playlist");
      await wait(1500);
      return { videos: cards().length, next_action: "Stop and talk." };
    }
  });
})();
