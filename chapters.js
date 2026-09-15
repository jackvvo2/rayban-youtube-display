(function () {
  "use strict";

  var chapterState = {
    chapters: [],
    currentChapterIndex: -1,
    videoId: null
  };

  // Make chapter functions available globally
  window.ChapterManager = {
    initialize: initializeChapters,
    parseChapters: parseChapters,
    getCurrentChapter: getCurrentChapter,
    getNextChapter: getNextChapter,
    getPreviousChapter: getPreviousChapter,
    getLastChapter: getLastChapter,
    seekToChapter: seekToChapter,
    updateCurrentChapter: updateCurrentChapter
  };

  // Listen for player ready event
  document.addEventListener("playerReady", function (event) {
    if (event.player) {
      initializeChapters(event.player, event.videoId);
    }
  });

  function initializeChapters(player, videoId) {
    chapterState.videoId = videoId;
    chapterState.player = player;
    chapterState.currentChapterIndex = -1;

    // Try to fetch video description to parse chapters
    if (videoId) {
      fetchVideoDescription(videoId);
    }

    // Update current chapter as video plays
    if (player && typeof player.getCurrentTime === "function") {
      setInterval(updateCurrentChapter, 1000);
    }
  }

  function fetchVideoDescription(videoId) {
    // Note: This requires YouTube Data API with proper authentication
    // For now, we'll parse chapters from common patterns
    var token = window.YouTubeAuth ? window.YouTubeAuth.getToken() : null;

    if (!token) {
      showChapterMessage("No YouTube auth for chapter data");
      return;
    }

    var url = "https://www.googleapis.com/youtube/v3/videos?id=" + encodeURIComponent(videoId) +
              "&part=snippet&access_token=" + encodeURIComponent(token);

    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.items && data.items.length > 0) {
          var description = data.items[0].snippet.description;
          parseChaptersFromDescription(description);
        }
      })
      .catch(function (error) {
        // Silently fail - chapters are optional
      });
  }

  function parseChaptersFromDescription(description) {
    if (!description) {
      return;
    }

    chapterState.chapters = [];
    var lines = description.split("\n");

    // Common chapter patterns: "0:00 Chapter Name", "00:00:00 Chapter Name", etc.
    var chapterRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/gm;
    var match;

    lines.forEach(function (line) {
      var timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/.exec(line.trim());
      if (timeMatch) {
        var hours = parseInt(timeMatch[1], 10);
        var minutes = parseInt(timeMatch[2], 10);
        var seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

        // Handle both HH:MM:SS and MM:SS formats
        var totalSeconds;
        if (hours > 59) {
          // Likely MM:SS format where first number is minutes
          totalSeconds = hours * 60 + minutes;
        } else {
          // HH:MM:SS format
          totalSeconds = hours * 3600 + minutes * 60 + seconds;
        }

        var title = timeMatch[4].trim();
        chapterState.chapters.push({
          title: title,
          startTime: totalSeconds,
          index: chapterState.chapters.length
        });
      }
    });

    if (chapterState.chapters.length > 0) {
      showChapterMessage("Found " + chapterState.chapters.length + " chapters");
    }
  }

  function parseChapters(description) {
    parseChaptersFromDescription(description);
  }

  function getCurrentChapter() {
    if (!chapterState.chapters.length || !chapterState.player) {
      return null;
    }

    var currentTime;
    try {
      currentTime = chapterState.player.getCurrentTime();
    } catch (error) {
      return null;
    }

    for (var i = chapterState.chapters.length - 1; i >= 0; i--) {
      if (chapterState.chapters[i].startTime <= currentTime) {
        return chapterState.chapters[i];
      }
    }

    return null;
  }

  function getNextChapter() {
    if (!chapterState.chapters.length) {
      showChapterMessage("No chapters available");
      return null;
    }

    var currentChapter = getCurrentChapter();
    var nextIndex = currentChapter ? currentChapter.index + 1 : 0;

    if (nextIndex < chapterState.chapters.length) {
      return chapterState.chapters[nextIndex];
    }

    showChapterMessage("Already at last chapter");
    return null;
  }

  function getPreviousChapter() {
    if (!chapterState.chapters.length) {
      showChapterMessage("No chapters available");
      return null;
    }

    var currentChapter = getCurrentChapter();
    var prevIndex = currentChapter ? currentChapter.index - 1 : -1;

    if (prevIndex >= 0) {
      return chapterState.chapters[prevIndex];
    }

    showChapterMessage("Already at first chapter");
    return null;
  }

  function getLastChapter() {
    if (!chapterState.chapters.length) {
      showChapterMessage("No chapters available");
      return null;
    }

    return chapterState.chapters[chapterState.chapters.length - 1];
  }

  function seekToChapter(chapter) {
    if (!chapter || !chapterState.player) {
      return;
    }

    try {
      chapterState.player.seekTo(chapter.startTime, true);
      showChapterMessage("Chapter: " + chapter.title);
      updateChapterDisplay(chapter);
    } catch (error) {
      showChapterMessage("Cannot seek in this player");
    }
  }

  function updateCurrentChapter() {
    var chapter = getCurrentChapter();
    if (chapter) {
      updateChapterDisplay(chapter);
    }
  }

  function updateChapterDisplay(chapter) {
    var display = document.getElementById("chapter-display");
    if (display) {
      if (chapter) {
        var totalChapters = chapterState.chapters.length;
        var currentIndex = chapter.index + 1;
        display.textContent = currentIndex + "/" + totalChapters + " " + chapter.title;
      } else {
        display.textContent = "No chapters";
      }
    }
  }

  function showChapterMessage(message) {
    var toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("visible");
      window.setTimeout(function () {
        toast.classList.remove("visible");
      }, 3000);
    }
  }
})();
