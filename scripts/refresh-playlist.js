var fs = require("fs");
var https = require("https");
var path = require("path");

var PLAYLIST_ID = "PLG4ASdiTQRwQ";
var FEED_URL = "https://www.youtube.com/feeds/videos.xml?playlist_id=" + encodeURIComponent(PLAYLIST_ID);
var OUT = path.resolve(__dirname, "..", "playlist.json");
var YT_NEXT_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

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
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () { resolve(chunks.join("")); });
    }).on("error", reject);
  });
}

function fetchJson(url, body) {
  return new Promise(function (resolve, reject) {
    var payload = JSON.stringify(body);
    var parsed = new URL(url);
    var req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "Mozilla/5.0"
      }
    }, function (res) {
      var chunks = [];
      res.setEncoding("utf8");
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        var text = chunks.join("");
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error("HTTP " + res.statusCode + " posting " + url));
          return;
        }
        try { resolve(JSON.parse(text)); } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function textBetween(source, startTag, endTag) {
  var start = source.indexOf(startTag);
  if (start === -1) return "";
  start += startTag.length;
  var end = source.indexOf(endTag, start);
  if (end === -1) return "";
  return decodeXml(source.slice(start, end).trim());
}

function attr(source, name) {
  var match = source.match(new RegExp(name + "=\"([^\"]*)\""));
  return match ? decodeXml(match[1]) : "";
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripText(value, max) {
  var cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (max && cleaned.length > max) return cleaned.slice(0, max - 1).trim() + "...";
  return cleaned;
}

function timestampToSeconds(stamp) {
  var parts = String(stamp || "").split(":").map(function (p) { return parseInt(p, 10); });
  if (parts.some(function (n) { return isNaN(n) || n < 0; })) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function secondsToTimestamp(total) {
  total = Math.max(0, Math.floor(Number(total) || 0));
  var hours = Math.floor(total / 3600);
  var minutes = Math.floor((total % 3600) / 60);
  var seconds = total % 60;
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  if (hours > 0) return hours + ":" + pad(minutes) + ":" + pad(seconds);
  return minutes + ":" + pad(seconds);
}

function dedupeChapters(chapters) {
  chapters.sort(function (a, b) { return a.start - b.start; });
  var unique = [];
  var seen = {};
  for (var j = 0; j < chapters.length; j++) {
    if (seen[chapters[j].start]) continue;
    seen[chapters[j].start] = true;
    unique.push(chapters[j]);
  }
  return unique.length < 2 ? [] : unique;
}

function parseChapters(description) {
  var text = String(description || "").replace(/\r\n/g, "\n");
  var lineRe = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:.|]?\s*(.*)$/;
  var chapters = [];
  var lines = text.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(lineRe);
    if (!match) continue;
    var seconds = timestampToSeconds(match[1]);
    if (seconds === null) continue;
    chapters.push({
      start: seconds,
      timestamp: match[1],
      title: stripText(match[2], 80) || ("Chapter " + (chapters.length + 1))
    });
  }
  var unique = dedupeChapters(chapters);
  if (unique.length) return unique;

  var inlineRe = /(
?)/g;
  inlineRe = /(\\d{1,2}:\\d{2}(?::\\d{2})?)/g;
  var stamps = [];
  var found;
  var stampRe = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
  while ((found = stampRe.exec(text)) !== null) {
    var start = timestampToSeconds(found[1]);
    if (start === null) continue;
    stamps.push({ start: start, timestamp: found[1], index: found.index, length: found[1].length });
  }
  chapters = [];
  for (var k = 0; k < stamps.length; k++) {
    var from = stamps[k].index + stamps[k].length;
    var to = k + 1 < stamps.length ? stamps[k + 1].index : text.length;
    var title = stripText(text.slice(from, to).replace(/^[\s\-–—:.|]+/, ""), 80);
    chapters.push({
      start: stamps[k].start,
      timestamp: stamps[k].timestamp,
      title: title || ("Chapter " + (chapters.length + 1))
    });
  }
  return dedupeChapters(chapters);
}

function walk(obj, visit) {
  if (!obj || typeof obj !== "object") return;
  visit(obj);
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) walk(obj[i], visit);
    return;
  }
  Object.keys(obj).forEach(function (key) { walk(obj[key], visit); });
}

function chaptersFromNextResponse(data) {
  var chapters = [];
  walk(data, function (node) {
    if (!node || !Array.isArray(node.markersMap)) return;
    node.markersMap.forEach(function (item) {
      var list = item && item.value && item.value.chapters;
      if (!Array.isArray(list) || item.key === "AUTO_CHAPTERS" && chapters.length) return;
      var parsed = [];
      list.forEach(function (entry) {
        var renderer = entry && entry.chapterRenderer;
        if (!renderer) return;
        var title = renderer.title && (renderer.title.simpleText || (renderer.title.runs && renderer.title.runs[0] && renderer.title.runs[0].text));
        var ms = Number(renderer.timeRangeStartMillis);
        if (!isFinite(ms) || ms < 0) return;
        var start = Math.floor(ms / 1000);
        parsed.push({
          start: start,
          timestamp: secondsToTimestamp(start),
          title: stripText(title, 80) || ("Chapter " + (parsed.length + 1))
        });
      });
      parsed = dedupeChapters(parsed);
      if (parsed.length > chapters.length) chapters = parsed;
    });
  });
  return chapters;
}

function fetchOfficialChapters(videoId) {
  return fetchJson("https://www.youtube.com/youtubei/v1/next?key=" + YT_NEXT_KEY, {
    context: { client: { clientName: "WEB", clientVersion: "2.20240901.00.00", hl: "en", gl: "US" } },
    videoId: videoId
  }).then(function (data) {
    return chaptersFromNextResponse(data);
  }).catch(function () { return []; });
}

function applyChapters(video, chapters) {
  var lastChapter = chapters.length ? chapters[chapters.length - 1] : null;
  if (lastChapter && lastChapter.start > 0) {
    video.chapters = chapters;
    video.lastChapter = { start: lastChapter.start, timestamp: lastChapter.timestamp, title: lastChapter.title };
    video.startAt = lastChapter.start;
    video.watchUrl = watchUrl(video.id, lastChapter.start);
  } else {
    delete video.chapters;
    delete video.lastChapter;
    delete video.startAt;
    video.watchUrl = watchUrl(video.id, 0);
  }
}

function watchUrl(videoId, startSeconds) {
  var url = "https://www.youtube.com/embed/" + videoId;
  if (startSeconds > 0) url += "?start=" + startSeconds;
  return url;
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
    var video = {
      id: textBetween(entry, "<yt:videoId>", "</yt:videoId>"),
      title: stripText(textBetween(entry, "<title>", "</title>"), 140),
      author: stripText(textBetween(textBetween(entry, "<author>", "</author>"), "<name>", "</name>"), 80),
      published: textBetween(entry, "<published>", "</published>"),
      updated: textBetween(entry, "<updated>", "</updated>"),
      thumbnail: thumbnailMatch ? attr(thumbnailMatch[0], "url") : "",
      description: stripText(rawDescription, 220)
    };
    applyChapters(video, parseChapters(rawDescription));
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

function enrichOfficialChapters(data) {
  var queue = data.videos.slice();
  function next() {
    var video = queue.shift();
    if (!video) return Promise.resolve(data);
    return fetchOfficialChapters(video.id).then(function (official) {
      if (official.length >= 2) applyChapters(video, official);
      return next();
    });
  }
  return next();
}

function comparable(data) {
  var copy = JSON.parse(JSON.stringify(data));
  delete copy.generatedAt;
  return copy;
}

function readExisting() {
  try { return JSON.parse(fs.readFileSync(OUT, "utf8")); }
  catch (error) { return null; }
}

fetchText(FEED_URL)
  .then(function (xml) {
    var data = parseFeed(xml);
    if (!data.videos.length) throw new Error("Playlist feed returned no videos");
    return enrichOfficialChapters(data);
  })
  .then(function (data) {
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
    console.error(error.message || error);
    process.exit(1);
  });
