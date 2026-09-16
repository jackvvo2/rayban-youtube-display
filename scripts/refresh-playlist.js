var fs = require("fs");
var https = require("https");
var path = require("path");

var PLAYLIST_ID = "PLG4ASdiTQRwQ";
var FEED_URL = "https://www.youtube.com/feeds/videos.xml?playlist_id=" + encodeURIComponent(PLAYLIST_ID);
var OUT = path.resolve(__dirname, "..", "playlist.json");

function fetchText(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, {
      headers: {
        "User-Agent": "rayban-youtube-display playlist refresher"
      }
    }, function (res) {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error("HTTP " + res.statusCode + " fetching " + url));
        res.resume();
        return;
      }

      var chunks = [];
      res.setEncoding("utf8");
      res.on("data", function (chunk) {
        chunks.push(chunk);
      });
      res.on("end", function () {
        resolve(chunks.join(""));
      });
    }).on("error", reject);
  });
}

function textBetween(source, startTag, endTag) {
  var start = source.indexOf(startTag);
  if (start === -1) {
    return "";
  }
  start += startTag.length;
  var end = source.indexOf(endTag, start);
  if (end === -1) {
    return "";
  }
  return decodeXml(source.slice(start, end).trim());
}

function attr(source, name) {
  var match = source.match(new RegExp(name + '="([^"]*)"'));
  return match ? decodeXml(match[1]) : "";
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripText(value, max) {
  var cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (max && cleaned.length > max) {
    return cleaned.slice(0, max - 1).trim() + "...";
  }
  return cleaned;
}

function timestampToSeconds(stamp) {
  var parts = String(stamp || "").split(":").map(function (p) {
    return parseInt(p, 10);
  });
  if (parts.some(function (n) { return isNaN(n) || n < 0; })) {
    return null;
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function parseChapters(description) {
  var text = String(description || "").replace(/\r\n/g, "\n");
  var lines = text.split("\n");
  var chapters = [];
  var stampRe = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-ââ:.]?\s*(.*)$/;

  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(stampRe);
    if (!match) {
      continue;
    }
    var seconds = timestampToSeconds(match[1]);
    if (seconds === null) {
      continue;
    }
    var title = stripText(match[2], 80) || ("Chapter " + (chapters.length + 1));
    chapters.push({
      start: seconds,
      timestamp: match[1],
      title: title
    });
  }

  chapters.sort(function (a, b) {
    return a.start - b.start;
  });

  var unique = [];
  var seen = {};
  for (var j = 0; j < chapters.length; j++) {
    if (seen[chapters[j].start]) {
      continue;
    }
    seen[chapters[j].start] = true;
    unique.push(chapters[j]);
  }

  // Need at least two timestamps to treat them as real chapters
  if (unique.length < 2) {
    return [];
  }
  return unique;
}

function parseFeed(xml) {
  var title = textBetween(xml, "<title>", "</title>") || "Meta Display App";
  var authorBlock = textBetween(xml, "<author>", "</author>");
  var channel = textBetween(authorBlock, "<name>", "</name>") || "YouTube playlist";
  var updated = textBetween(xml, "<published>", "</published>") || "";
  var entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  var videos = entries.map(function (entry) {
    var mediaGroup = textBetween(entry, "<media:group>", "</media:group>");
    var thumbnailMatch = mediaGroup.match(/<media:thumbnail\s+[^>]*>/);
    var rawDescription = textBetween(mediaGroup, "<media:description>", "</media:description>");
    var chapters = parseChapters(rawDescription);
    var lastChapter = chapters.length ? chapters[chapters.length - 1] : null;
    var video = {
      id: textBetween(entry, "<yt:videoId>", "</yt:videoId>"),
      title: stripText(textBetween(entry, "<title>", "</title>"), 140),
      author: stripText(textBetween(textBetween(entry, "<author>", "</author>"), "<name>", "</name>"), 80),
      published: textBetween(entry, "<published>", "</published>"),
      updated: textBetween(entry, "<updated>", "</updated>"),
      thumbnail: thumbnailMatch ? attr(thumbnailMatch[0], "url") : "",
      description: stripText(rawDescription, 220)
    };

    if (lastChapter && lastChapter.start > 0) {
      video.chapters = chapters;
      video.lastChapter = {
        start: lastChapter.start,
        timestamp: lastChapter.timestamp,
        title: lastChapter.title
      };
      // YouTube watch URL / embed start time
      video.startAt = lastChapter.start;
      video.watchUrl = "https://www.youtube.com/watch?v=" + video.id + "&t=" + lastChapter.start + "s";
    } else {
      video.watchUrl = "https://www.youtube.com/watch?v=" + video.id;
    }

    return video;
  }).filter(function (video) {
    return /^[A-Za-z0-9_-]{11}$/.test(video.id);
  });

  return {
    playlistId: PLAYLIST_ID,
    title: stripText(title, 90),
    channel: stripText(channel, 80),
    sourceUrl: "https://youtube.com/playlist?list=" + PLAYLIST_ID,
    feedUrl: FEED_URL,
    published: updated,
    generatedAt: new Date().toISOString(),
    videos: videos
  };
}

function comparable(data) {
  var copy = JSON.parse(JSON.stringify(data));
  delete copy.generatedAt;
  return copy;
}

function readExisting() {
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch (error) {
    return null;
  }
}

fetchText(FEED_URL)
  .then(function (xml) {
    var data = parseFeed(xml);
    if (!data.videos.length) {
      throw new Error("Playlist feed returned no videos");
    }
    var existing = readExisting();
    if (existing && JSON.stringify(comparable(existing)) === JSON.stringify(comparable(data))) {
      console.log("Playlist unchanged: " + data.videos.length + " videos");
      return;
    }
    fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
    var withChapters = data.videos.filter(function (v) { return v.startAt; }).length;
    console.log("Wrote " + data.videos.length + " videos to " + OUT + " (" + withChapters + " start at last chapter)");
  })
  .catch(function (error) {
    console.error(error.message);
    process.exit(1);
  });