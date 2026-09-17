(function () {
  "use strict";

  var chapterState = {
    chapters: [],
    currentChapterIndex: -1,
    videoId: null,
    tickStarted: false
  };

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

  document.addEventListener("playerReady", function (event) {
    var detail = event.detail || {};
    var player = detail.player || event.player;
    var videoId = detail.videoId || event.videoId;
    var video = detail.video || null;
    if (player) {
      initializeChapters(player, videoId, video);
    }
  });

  function initializeChapters(player, videoId, video) {
    chapterState.videoId = videoId;
    chapterState.player = player;
    chapterState.currentChapterIndex = -1;
    chapterState.chapters = [];

    if (video && Array.isArray(video.chapters) && video.chapters.length) {
      applyPlaylistChapters(video.chapters);
    } else if (videoId) {
      fetchVideoDescription(videoId);
    }

    if (!chapterState.tickStarted && player && typeof player.getCurrentTime === "function") {
      chapterState.tickStarted = true;
      setInterval(updateCurrentChapter, 1000);
    }
  }

  function applyPlaylistChapters(chapters) {
    chapterState.chapters = chapters.map(function (chapter, index) {
      return {
        title: chapter.title || ("Chapter " + (index + 1)),
        startTime: Number(chapter.start) || 0,
        index: index
      };
    });
    if (chapterState.chapters.length) {
      showChapterMessage("Found " + chapterState.chapters.length + " chapters");
    }
  }

  function fetchVideoDescription(videoId) {
    var token = window.YouTubeAuth ? window.YouTubeAuth.getToken() : null;

    if (!token) {
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
      .catch(function () {});
  }

  function parseChaptersFromDescription(description) {
    if (!description) {
      return;
    }

    chapterState.chapters = [];
    var lines = description.split("\n");

    lines.forEach(function (line) {
      var timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/.exec(line.trim());
      if (timeMatch) {
        var hours = parseInt(timeMatch[1], 10);
        var minutes = parseInt(timeMatch[2], 10);
        var seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        var totalSeconds;
        if (timeMatch[3] === undefined) {
          totalSeconds = hours * 60 + minutes;
        } else {
          totalSeconds = hours * 3600 + minutes * 60 + seconds;
        }

        chapterState.chapters.push({
          title: timeMatch[4].trim(),
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
