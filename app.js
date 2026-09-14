(function () {
  "use strict";

  var CONFIG = {
    appName: "Meta Display Playlist",
    storageKey: "rayban-youtube-display:playlist:v1",
    playlistId: "PLG4ASdiTQRwQ&si=Kxg73gP5vH0K9Muc",
    playlistUrl: "playlist.json",
    youtubeBase: "https://www.youtube.com"
  };

  var state = {
    currentScreen: "home-screen",
    screenStack: [],
    playlist: null,
    videos: [],
    activeIndex: 0,
    activeVideoId: "",
    launchVideoId: "",
    player: null,
    playerReady: false,
    playerState: "idle",
    controlsVisible: false,
    apiPromise: null,
    toastTimer: 0
  };

  var playlistTitle;
  var playlistSummary;
  var playlistUpdated;
  var playlistList;
  var playerTarget;
  var playerStatus;
  var playerEyebrow;
  var videoTitle;
  var playerControls;
  var controlsToggle;
  var toast;

  document.addEventListener("DOMContentLoaded", function () {
    playlistTitle = document.getElementById("playlist-title");
    playlistSummary = document.getElementById("playlist-summary");
    playlistUpdated = document.getElementById("playlist-updated");
    playlistList = document.getElementById("playlist-list");
    playerTarget = document.getElementById("player-target");
    playerStatus = document.getElementById("player-status");
    playerEyebrow = document.getElementById("player-eyebrow");
    videoTitle = document.getElementById("video-title");
    playerControls = document.getElementById("player-controls");
    controlsToggle = document.getElementById("controls-toggle");
    toast = document.getElementById("toast");

    state.launchVideoId = getLaunchVideoId();
    restoreState();
    bindEvents();
    registerServiceWorker();
    loadPlaylistData(false);
  });

  function bindEvents() {
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-action]");
      if (!target) {
        return;
      }
      handleAction(target.dataset.action, target);
    });
  }

  function handleKeydown(event) {
    var keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Escape", "Backspace"];
    if (keys.indexOf(event.key) === -1) {
      return;
    }

    if (event.key.indexOf("Arrow") === 0) {
      event.preventDefault();
      moveFocus(event.key.replace("Arrow", "").toLowerCase());
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      var active = document.activeElement;
      if (active && active.classList.contains("focusable")) {
        event.preventDefault();
        active.click();
      }
      return;
    }

    event.preventDefault();
    if (state.currentScreen === "player-screen" && state.controlsVisible) {
      setControlsVisible(false);
      return;
    }
    goBack();
  }

  function handleAction(action, element) {
    switch (action) {
      case "play-index":
        startVideoByIndex(Number(element.dataset.index), false);
        break;
      case "player-toggle":
        togglePlayer();
        break;
      case "previous-video":
        playRelative(-1);
        break;
      case "next-video":
        playRelative(1);
        break;
      case "refresh-playlist":
        loadPlaylistData(true);
        break;
      case "toggle-controls":
        setControlsVisible(!state.controlsVisible);
        break;
      case "home":
        showScreen("home-screen", true);
        break;
      case "back":
        goBack();
        break;
      default:
        showToast("Action unavailable");
    }
  }

  function loadPlaylistData(force) {
    var url = CONFIG.playlistUrl + (force ? "?t=" + Date.now() : "");
    if (force) {
      showToast("Refreshing playlist...");
    }

    return fetch(url, { cache: force ? "no-store" : "default" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        applyPlaylistData(data, force);
      })
      .catch(function () {
        playlistSummary.textContent = "Playlist could not load.";
        playlistUpdated.textContent = "Check network and refresh.";
        renderEmpty("Playlist unavailable. Try Refresh.");
        showToast("Playlist refresh failed");
      });
  }

  function applyPlaylistData(data, force) {
    var videos = Array.isArray(data.videos) ? data.videos.filter(isValidVideo) : [];
    if (!videos.length) {
      throw new Error("No playlist videos");
    }

    state.playlist = data;
    state.videos = videos;

    if (data.title) {
      playlistTitle.textContent = data.title;
    }
    playlistSummary.textContent = videos.length + " videos from " + (data.channel || "YouTube");
    playlistUpdated.textContent = "Updated " + formatDate(data.generatedAt || data.published);

    var launchIndex = state.launchVideoId ? findVideoIndex(state.launchVideoId) : -1;
    var savedIndex = state.activeVideoId ? findVideoIndex(state.activeVideoId) : -1;

    if (launchIndex !== -1) {
      state.launchVideoId = "";
      renderPlaylist();
      startVideoByIndex(launchIndex, true);
      return;
    }

    if (savedIndex !== -1) {
      state.activeIndex = savedIndex;
    } else {
      state.activeIndex = Math.min(state.activeIndex, videos.length - 1);
      state.activeVideoId = videos[state.activeIndex].id;
    }

    renderPlaylist();
    updatePlayerLabels();

    if (force) {
      showToast("Playlist refreshed");
    }
    if (state.currentScreen === "home-screen") {
      window.setTimeout(focusFirst, 0);
    }
  }

  function isValidVideo(video) {
    return video && /^[A-Za-z0-9_-]{11}$/.test(video.id) && video.title;
  }

  function renderPlaylist() {
    playlistList.textContent = "";
    if (!state.videos.length) {
      renderEmpty("No videos found.");
      return;
    }

    state.videos.forEach(function (video, index) {
      var button = document.createElement("button");
      button.className = "focusable action-card video-card" + (index === state.activeIndex ? " primary" : "");
      button.dataset.action = "play-index";
      button.dataset.index = String(index);
      if (index === 0) {
        button.setAttribute("data-preferred-focus", "");
      }

      var content = document.createElement("span");
      content.className = "content";

      var title = document.createElement("span");
      title.className = "label";
      title.textContent = video.title;

      var meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = (index + 1) + " of " + state.videos.length + " • " + (video.author || "YouTube");

      content.appendChild(title);
      content.appendChild(meta);
      button.appendChild(content);
      playlistList.appendChild(button);
    });
  }

  function renderEmpty(message) {
    playlistList.textContent = "";
    var empty = document.createElement("div");
    empty.className = "empty-card";
    empty.textContent = message;
    playlistList.appendChild(empty);
  }

  function startVideoByIndex(index) {
    if (!state.videos.length) {
      showToast("Playlist is still loading");
      return;
    }

    if (!Number.isFinite(index)) {
      index = 0;
    }
    if (index < 0) {
      index = state.videos.length - 1;
    } else if (index >= state.videos.length) {
      index = 0;
    }

    state.activeIndex = index;
    state.activeVideoId = state.videos[index].id;
    saveState();
    renderPlaylist();
    updatePlayerLabels();
    setControlsVisible(false);
    showScreen("player-screen");
    createOrLoadPlayer(state.activeVideoId);
  }

  function playRelative(offset) {
    if (!state.videos.length) {
      showToast("Playlist is still loading");
      return;
    }
    startVideoByIndex(state.activeIndex + offset, false);
  }

  function updatePlayerLabels() {
    var video = state.videos[state.activeIndex];
    if (!video) {
      videoTitle.textContent = "Playlist video";
      playerEyebrow.textContent = "Now playing";
      return;
    }
    videoTitle.textContent = video.title;
    playerEyebrow.textContent = "Video " + (state.activeIndex + 1) + " of " + state.videos.length;
  }

  function createOrLoadPlayer(videoId) {
    if (state.player && typeof state.player.loadVideoById === "function") {
      state.playerReady = true;
      playerStatus.textContent = "Loading selected video...";
      state.player.loadVideoById(videoId);
      return;
    }

    state.playerReady = false;
    ensurePlayerPlaceholder("Loading YouTube player...");

    loadYouTubeApi()
      .then(function () {
        playerTarget.innerHTML = "";
        state.player = new window.YT.Player("player-target", {
          width: 584,
          height: 329,
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
      })
      .catch(function () {
        loadFallbackIframe(videoId);
      });
  }

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) {
      return Promise.resolve();
    }

    if (state.apiPromise) {
      return state.apiPromise;
    }

    state.apiPromise = new Promise(function (resolve, reject) {
      var timeout = window.setTimeout(function () {
        reject(new Error("YouTube API timed out"));
      }, 6000);

      window.onYouTubeIframeAPIReady = function () {
        window.clearTimeout(timeout);
        resolve();
      };

      var script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = function () {
        window.clearTimeout(timeout);
        reject(new Error("YouTube API failed"));
      };
      document.head.appendChild(script);
    });

    return state.apiPromise;
  }

  function onPlayerReady(event) {
    state.playerReady = true;
    playerStatus.textContent = "Ready. Use Next and Previous to move through the list.";
    try {
      event.target.playVideo();
    } catch (error) {
      playerStatus.textContent = "Ready. Press Play / Pause to start.";
    }
    focusFirst();
  }

  function onPlayerStateChange(event) {
    var YT = window.YT || {};
    var playerStates = YT.PlayerState || {};
    if (event.data === playerStates.PLAYING) {
      state.playerState = "playing";
      playerStatus.textContent = "Playing " + (state.activeIndex + 1) + " of " + state.videos.length + ".";
    } else if (event.data === playerStates.PAUSED) {
      state.playerState = "paused";
      playerStatus.textContent = "Paused.";
    } else if (event.data === playerStates.ENDED) {
      state.playerState = "ended";
      if (state.activeIndex < state.videos.length - 1) {
        playRelative(1);
      } else {
        playerStatus.textContent = "End of playlist.";
      }
    } else if (event.data === playerStates.BUFFERING) {
      playerStatus.textContent = "Buffering...";
    }
  }

  function onPlayerError() {
    playerStatus.textContent = "YouTube could not play this item inline. Try Next.";
    showToast("Video unavailable");
  }

  function loadFallbackIframe(videoId) {
    var iframe = document.createElement("iframe");
    iframe.title = "YouTube web player";
    iframe.src = embedUrl(videoId);
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    playerTarget.innerHTML = "";
    playerTarget.appendChild(iframe);
    state.playerReady = false;
    playerStatus.textContent = "Inline player loaded. Next and Previous reload the frame.";
    focusFirst();
  }

  function ensurePlayerPlaceholder(text) {
    playerTarget.innerHTML = "";
    var placeholder = document.createElement("div");
    placeholder.className = "player-placeholder";
    placeholder.textContent = text;
    playerTarget.appendChild(placeholder);
  }

  function togglePlayer() {
    if (!state.activeVideoId) {
      startVideoByIndex(state.activeIndex, false);
      return;
    }
    if (!state.playerReady || !state.player) {
      loadFallbackIframe(state.activeVideoId);
      return;
    }

    if (state.playerState === "playing") {
      state.player.pauseVideo();
    } else {
      state.player.playVideo();
    }
  }

  function setControlsVisible(visible) {
    state.controlsVisible = Boolean(visible);
    if (!playerControls || !controlsToggle) {
      return;
    }

    playerControls.classList.toggle("is-hidden", !state.controlsVisible);
    controlsToggle.setAttribute("aria-expanded", state.controlsVisible ? "true" : "false");
    controlsToggle.textContent = state.controlsVisible ? "Hide" : "Controls";

    window.setTimeout(function () {
      if (state.controlsVisible) {
        var playToggle = document.getElementById("play-toggle");
        if (playToggle) {
          focusElement(playToggle);
        }
      } else {
        focusElement(controlsToggle);
      }
    }, 0);
  }

  function showScreen(screenId, resetStack) {
    var current = document.getElementById(state.currentScreen);
    var next = document.getElementById(screenId);
    if (!next || current === next) {
      return;
    }

    if (current && !resetStack) {
      state.screenStack.push(state.currentScreen);
    }
    if (resetStack) {
      state.screenStack = [];
    }

    document.querySelectorAll(".screen").forEach(function (screen) {
      screen.classList.toggle("active", screen.id === screenId);
    });
    state.currentScreen = screenId;
    window.setTimeout(focusFirst, 0);
  }

  function goBack() {
    var previous = state.screenStack.pop();
    if (!previous) {
      if (state.currentScreen !== "home-screen") {
        showScreen("home-screen", true);
      }
      return;
    }

    document.querySelectorAll(".screen").forEach(function (screen) {
      screen.classList.toggle("active", screen.id === previous);
    });
    state.currentScreen = previous;
    window.setTimeout(focusFirst, 0);
  }

  function activeFocusables() {
    var screen = document.getElementById(state.currentScreen);
    if (!screen) {
      return [];
    }
    return Array.prototype.slice.call(screen.querySelectorAll(".focusable:not([disabled])"))
      .filter(function (element) {
        return element.offsetParent !== null;
      });
  }

  function focusFirst() {
    var elements = activeFocusables();
    if (!elements.length) {
      return;
    }
    var preferred = document.querySelector("#" + state.currentScreen + " [data-preferred-focus]");
    focusElement(preferred || elements[0]);
  }

  function focusElement(element) {
    element.focus({ preventScroll: true });
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function moveFocus(direction) {
    var elements = activeFocusables();
    if (!elements.length) {
      return;
    }

    var current = document.activeElement;
    if (elements.indexOf(current) === -1) {
      focusElement(elements[0]);
      return;
    }

    var currentRect = current.getBoundingClientRect();
    var currentCenter = centerOf(currentRect);
    var scored = elements
      .filter(function (element) {
        return element !== current;
      })
      .map(function (element) {
        var rect = element.getBoundingClientRect();
        var center = centerOf(rect);
        var dx = center.x - currentCenter.x;
        var dy = center.y - currentCenter.y;
        var primary = direction === "left" || direction === "right" ? dx : dy;
        var secondary = direction === "left" || direction === "right" ? dy : dx;
        var inDirection =
          (direction === "left" && dx < -2) ||
          (direction === "right" && dx > 2) ||
          (direction === "up" && dy < -2) ||
          (direction === "down" && dy > 2);

        return {
          element: element,
          inDirection: inDirection,
          score: Math.abs(primary) * 10 + Math.abs(secondary)
        };
      })
      .filter(function (item) {
        return item.inDirection;
      })
      .sort(function (a, b) {
        return a.score - b.score;
      });

    if (scored.length) {
      focusElement(scored[0].element);
      return;
    }

    var index = elements.indexOf(current);
    var backwards = direction === "left" || direction === "up";
    var nextIndex = backwards ? index - 1 : index + 1;
    if (nextIndex < 0) {
      nextIndex = elements.length - 1;
    } else if (nextIndex >= elements.length) {
      nextIndex = 0;
    }
    focusElement(elements[nextIndex]);
  }

  function centerOf(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function getLaunchVideoId() {
    var params = new URLSearchParams(window.location.search);
    return normalizeVideoId(params.get("v") || params.get("video") || params.get("url"));
  }

  function normalizeVideoId(value) {
    if (!value) {
      return "";
    }

    var trimmed = String(value).trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    try {
      var parsed = new URL(trimmed);
      if (parsed.hostname === "youtu.be") {
        return normalizeVideoId(parsed.pathname.slice(1));
      }
      if (parsed.hostname.endsWith("youtube.com")) {
        if (parsed.pathname === "/watch") {
          return normalizeVideoId(parsed.searchParams.get("v"));
        }
        var parts = parsed.pathname.split("/").filter(Boolean);
        if ((parts[0] === "embed" || parts[0] === "shorts") && parts[1]) {
          return normalizeVideoId(parts[1]);
        }
      }
    } catch (error) {
      return "";
    }

    return "";
  }

  function findVideoIndex(videoId) {
    return state.videos.findIndex(function (video) {
      return video.id === videoId;
    });
  }

  function embedUrl(videoId) {
    return CONFIG.youtubeBase + "/embed/" + encodeURIComponent(videoId) +
      "?autoplay=1&playsinline=1&rel=0&modestbranding=1";
  }

  function formatDate(value) {
    if (!value) {
      return "just now";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "just now";
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
      date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () {
      toast.classList.remove("visible");
    }, Math.min(8000, 3500 + Math.max(0, message.split(" ").length - 2) * 300));
  }

  function restoreState() {
    try {
      var raw = window.localStorage.getItem(CONFIG.storageKey);
      if (!raw) {
        return;
      }
      var saved = JSON.parse(raw);
      var savedVideo = normalizeVideoId(saved.activeVideoId);
      if (savedVideo) {
        state.activeVideoId = savedVideo;
      }
    } catch (error) {
      window.localStorage.removeItem(CONFIG.storageKey);
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        activeVideoId: state.activeVideoId,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      // Local storage can be disabled in some webviews; playback still works.
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
      return;
    }

    navigator.serviceWorker.register("service-worker.js").catch(function () {
      // Static caching is optional; do not block the player on registration errors.
    });
  }
})();
