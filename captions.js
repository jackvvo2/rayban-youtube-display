/* YouTube closed captions on/off with a saved preference.
 * Preference ("on" | "off", unset = YouTube default) lives in localStorage so
 * it carries across videos and relaunches:
 *  - new players get cc_load_policy / cc_lang_pref via Captions.playerVars()
 *    (app.js) and the fallback embed via Captions.embedParams();
 *  - each newly loaded video gets the preference re-applied once it plays,
 *    because loadVideoById does not reuse playerVars.
 * Uses the IFrame API captions module: loadModule/setOption track to turn on,
 * setOption track {} + unloadModule to turn off. YouTube may ignore these for
 * some videos (no tracks, or auto-generated captions only).
 * window.Captions feeds the WebMCP captions and player_status tools.
 */
(function () {
  "use strict";

  var KEY = "rayban-youtube-display:captions:v1";
  var POLL_MS = 500;

  var player = null;
  var appliedFor = "";
  var retryTimer = 0;

  function readPref() {
    try {
      var v = window.localStorage.getItem(KEY);
      return v === "on" || v === "off" ? v : null;
    } catch (error) {
      return null;
    }
  }

  function writePref(on) {
    try {
      window.localStorage.setItem(KEY, on ? "on" : "off");
    } catch (error) {}
  }

  function langPref() {
    var lang = String((window.navigator && window.navigator.language) || "en");
    return lang.split("-")[0].toLowerCase() || "en";
  }

  function hasApi(p) {
    return Boolean(p && typeof p.setOption === "function" && typeof p.loadModule === "function");
  }

  function currentVideoId(p) {
    try {
      var d = p.getVideoData && p.getVideoData();
      return (d && d.video_id) || "";
    } catch (error) {
      return "";
    }
  }

  function pickTrack(p) {
    var list = null;
    try { list = p.getOption("captions", "tracklist"); } catch (error) {}
    if (!Array.isArray(list) || !list.length) {
      return { languageCode: langPref() };
    }
    var want = langPref();
    var match = list.filter(function (t) { return t && String(t.languageCode || "").split("-")[0] === want; });
    var manual = match.filter(function (t) { return t.kind !== "asr"; });
    var track = manual[0] || match[0] || list[0];
    return { languageCode: track.languageCode };
  }

  // Returns true when the commands were sent (not a guarantee YouTube obeyed).
  function applyTo(p, on) {
    if (!hasApi(p)) {
      return false;
    }
    try {
      if (on) {
        p.loadModule("captions");
        p.setOption("captions", "track", pickTrack(p));
      } else {
        p.setOption("captions", "track", {});
        if (typeof p.unloadModule === "function") {
          p.unloadModule("captions");
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function applyPref() {
    var pref = readPref();
    if (!pref || !hasApi(player)) {
      return false;
    }
    var ok = applyTo(player, pref === "on");
    // The captions module loads asynchronously; send once more shortly after.
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(function () {
      if (readPref() === pref) {
        applyTo(player, pref === "on");
      }
    }, 1500);
    return ok;
  }

  function playing(p) {
    try {
      var s = p.getPlayerState();
      return s === 1 || s === 3;
    } catch (error) {
      return false;
    }
  }

  // Re-apply the saved preference once per newly playing video.
  function poll() {
    if (!hasApi(player) || !readPref() || !playing(player)) {
      return;
    }
    var id = currentVideoId(player) || "unknown";
    if (id === appliedFor) {
      return;
    }
    appliedFor = id;
    applyPref();
  }

  document.addEventListener("playerReady", function (event) {
    var d = event.detail || {};
    if (d.player) {
      player = d.player;
    }
    appliedFor = "";
  });

  window.setInterval(poll, POLL_MS);

  window.Captions = {
    KEY: KEY,
    pref: readPref,
    // Saves the preference and applies it to the open player if any.
    set: function (on) {
      on = Boolean(on);
      writePref(on);
      var applied = applyTo(player, on);
      if (applied) {
        appliedFor = currentVideoId(player) || "unknown";
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(function () {
          if (readPref() === (on ? "on" : "off")) {
            applyTo(player, on);
          }
        }, 1500);
      }
      return { captions: on ? "on" : "off", applied: applied };
    },
    hasPlayer: function () { return hasApi(player); },
    // Best-effort live track; null when unknown.
    track: function () {
      if (!hasApi(player) || typeof player.getOption !== "function") {
        return null;
      }
      try {
        var t = player.getOption("captions", "track");
        return t && t.languageCode ? String(t.languageCode) : null;
      } catch (error) {
        return null;
      }
    },
    playerVars: function () {
      var pref = readPref();
      if (pref === "on") {
        return { cc_load_policy: 1, cc_lang_pref: langPref() };
      }
      if (pref === "off") {
        return { cc_load_policy: 0 };
      }
      return {};
    },
    embedParams: function () {
      var vars = this.playerVars();
      return Object.keys(vars).map(function (k) {
        return "&" + k + "=" + encodeURIComponent(vars[k]);
      }).join("");
    }
  };
})();
