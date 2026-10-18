/* WebMCP tools for Meta Ray-Ban Display (document.modelContext).
 * Feature-detected: no-op when document.modelContext is absent.
 * Drives the existing UI by clicking [data-action] buttons so app.js and the
 * add-on scripts (persist-playback, chapters, play-toggle-fix) stay the single
 * source of truth. video_size uses window.VideoFocus (video-focus.js).
 * Docs: https://wearables.developer.meta.com/docs/develop/webapps/agent-tools/
 */
(function () {
  "use strict";

  var mc = document.modelContext;
  var badge = null;
  var baseText = "";
  var flashTimer = 0;
  var okCount = 0;
  var failed = false;

  function setBadge(text) {
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "webmcp-status";
      badge.setAttribute("aria-hidden", "true");
      badge.style.cssText = "position:fixed;left:8px;bottom:6px;z-index:9999;pointer-events:none;" +
        "font:600 12px/1.2 system-ui,sans-serif;color:#9fb3c8;background:rgba(0,0,0,.55);" +
        "padding:2px 6px;border-radius:6px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
      (document.body || document.documentElement).appendChild(badge);
    }
    badge.textContent = text;
  }
  function showBase() { setBadge(baseText); }
  function flash(name) {
    window.clearTimeout(flashTimer);
    setBadge("WebMCP: " + name);
    badge.style.color = "#7CFFB2";
    // is-flash lets the green flash show briefly even during video blackout.
    if (badge.classList) { badge.classList.add("is-flash"); }
    flashTimer = window.setTimeout(function () {
      badge.style.color = "#9fb3c8";
      if (badge.classList) { badge.classList.remove("is-flash"); }
      showBase();
    }, 2500);
  }
  function updateBase() {
    baseText = failed && !okCount ? "WebMCP: error" : "WebMCP: " + okCount + " tools" + (failed ? " (some failed)" : "");
    showBase();
  }
  function onReady(fn) {
    if (document.body) { fn(); } else { document.addEventListener("DOMContentLoaded", fn); }
  }

  if (!mc || typeof mc.registerTool !== "function") {
    baseText = "WebMCP: off";
    onReady(showBase);
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

  // registerTool may return a promise, a handle, or undefined depending on the
  // build, and may throw synchronously. Never chain .catch blindly.
  function register(def) {
    var run = def.execute;
    def.execute = function (input, opts) {
      var signal = opts && opts.signal;
      if (signal && signal.aborted) {
        return Promise.reject(signal.reason || new DOMException("Aborted", "AbortError"));
      }
      try { flash(def.name); } catch (e) { /* ignore */ }
      var work = Promise.resolve().then(function () { return run.call(def, input || {}, opts || {}); });
      if (!signal || typeof signal.addEventListener !== "function") { return work; }
      // Stop waiting as soon as the host cancels (e.g. the 10 s deadline).
      return Promise.race([work, new Promise(function (resolve, reject) {
        signal.addEventListener("abort", function () {
          reject(signal.reason || new DOMException("Aborted", "AbortError"));
        }, { once: true });
      })]);
    };
    try {
      var r = mc.registerTool(def);
      if (r && typeof r.then === "function") {
        r.then(function () { okCount++; updateBase(); }, function (err) {
          failed = true; updateBase(); console.error("WebMCP " + def.name + " failed", err);
        });
      } else {
        okCount++;
      }
    } catch (err) {
      failed = true;
      console.error("WebMCP " + def.name + " failed", err);
    }
    onReady(updateBase);
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
    annotations: { untrustedContentHint: true },
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
      // Everything except next/previous video acts on the open player; on the
      // playlist screen (or before a YouTube player exists) these would
      // silently do nothing, so say so instead of reporting success.
      if (a !== "next-video" && a !== "previous-video") {
        var scr = document.querySelector(".screen.active");
        if (!player || !scr || scr.id !== "player-screen") {
          return { error: "no_player", message: "No video is open.", now: playerInfo(), next_action: "Call player_open or play_video first." };
        }
      }
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
    annotations: { untrustedContentHint: true },
    description: "Jump to a time in the current video, in seconds from the start.",
    inputSchema: { type: "object", properties: { seconds: { type: "number", description: "Target time in seconds." } }, required: ["seconds"] },
    async execute(input) {
      var s = Number(input && input.seconds);
      if (!isFinite(s) || s < 0) { return { error: "bad_time", message: "Seconds must be zero or more." }; }
      if (!player || typeof player.seekTo !== "function") { return { error: "no_player", message: "No video is playing.", next_action: "Call play_video first." }; }
      var dur = 0;
      try { dur = Number(player.getDuration()) || 0; } catch (e) { /* ignore */ }
      var clamped = false;
      if (dur > 0 && s > dur - 1) { s = Math.max(0, Math.floor(dur - 1)); clamped = true; }
      player.seekTo(s, true);
      return settle(clamped ? { seeked_to: s, clamped: true, message: "That is past the end; jumped near the end instead." } : { seeked_to: s });
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
    name: "player_open",
    annotations: { untrustedContentHint: true },
    description: "Open player / show video / resume / continue watching: reopen the video player from the playlist with the last video at its saved position (video 1 if none), same as the Open player button.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      var active = document.querySelector(".screen.active");
      if (active && active.id === "player-screen") {
        return { ok: false, message: "The player is already open.", now: playerInfo(), next_action: "Stop and talk, or call playback_control." };
      }
      if (!clickAction("resume-player")) {
        if (!cards().length) {
          return { ok: false, message: "Playlist is not loaded yet.", now: playerInfo(), next_action: "Call playlist_refresh, then try again." };
        }
        cards()[0].click();
      }
      await wait(900);
      var info = playerInfo();
      return { ok: info.screen === "player-screen", now: info, next_action: "Confirm in one short sentence. Stop and talk." };
    }
  });

  register({
    name: "player_close",
    description: "Close player / hide video / go back: leave the video player and return to the playlist, same as the on-screen Back button.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      var active = document.querySelector(".screen.active");
      if (!active || active.id !== "player-screen") {
        return { ok: false, message: "The player is not open; the playlist is already showing.", now: { screen: active ? active.id : "" }, next_action: "Stop and talk." };
      }
      if (!clickAction("back", "")) {
        return { ok: false, message: "Back button not found.", now: { screen: active.id }, next_action: "Stop and talk." };
      }
      await wait(300);
      var now = document.querySelector(".screen.active");
      return { ok: !!now && now.id !== "player-screen", now: { screen: now ? now.id : "" }, next_action: "Confirm in one short sentence. Stop and talk." };
    }
  });

  register({
    name: "video_size",
    description: "Make video bigger or smaller: set the video size as a percent of full size (20-100), centered on black. E.g. 'make video 70 percent' means percent 70. Saved for next launch.",
    inputSchema: {
      type: "object",
      properties: { percent: { type: "number", minimum: 20, maximum: 100, description: "Video size as a percent of full size, 20 to 100." } },
      required: ["percent"]
    },
    async execute(input, opts) {
      var signal = opts && opts.signal;
      var vf = window.VideoFocus;
      if (!vf || typeof vf.setSize !== "function") { return { error: "unavailable", message: "Video sizing is not available." }; }
      var raw = input ? input.percent : undefined;
      var p = typeof raw === "string" ? Number(raw.replace(/%/g, "").trim()) : Number(raw);
      if (raw === undefined || raw === null || raw === "" || !isFinite(p)) {
        return { error: "bad_percent", message: "percent must be a number from 20 to 100.", size_percent: vf.getSize(), next_action: "Ask the user for a size, then retry." };
      }
      if (signal && signal.aborted) { throw signal.reason || new DOMException("Aborted", "AbortError"); }
      var applied = vf.setSize(p);
      var result = { size_percent: applied, next_action: "Confirm in one short sentence. Stop and talk." };
      if (applied !== Math.round(p)) { result.clamped = true; result.message = "Size limited to 20-100 percent."; }
      return result;
    }
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
