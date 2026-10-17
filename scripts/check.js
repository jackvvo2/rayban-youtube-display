var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

var root = path.resolve(__dirname, "..");
var failures = [];

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function readPngSize(name) {
  var file = fs.readFileSync(path.join(root, name));
  var signature = file.subarray(0, 8).toString("hex");
  assert(signature === "89504e470d0a1a0a", name + " is a PNG");
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20)
  };
}

var html = read("index.html");
var css = read("styles.css");
var js = read("app.js");
var serviceWorker = read("service-worker.js");
var refreshWorkflow = read(".github/workflows/refresh-playlist.yml");
var playlist = JSON.parse(read("playlist.json"));
var manifest = JSON.parse(read("manifest.webmanifest"));

assert(html.indexOf("width=600, height=600") !== -1, "viewport is fixed to 600x600");
assert(/class="[^"]*screen[^"]*"/.test(html), "screens use .screen class");
assert(new Set(Array.from(html.matchAll(/id="([^"]+-screen)"/g)).map(function (match) {
  return match[1];
})).size >= 2, "screens have unique ids");
assert(html.indexOf('id="playlist-list"') !== -1, "playlist list is present");
assert(html.indexOf('data-action="refresh-playlist"') !== -1, "refresh playlist control is present");
assert(html.indexOf('data-action="next-video"') !== -1, "next video control is present");
assert(html.indexOf('data-action="previous-video"') !== -1, "previous video control is present");
assert(html.indexOf('data-action="toggle-controls"') !== -1, "cinema controls toggle is present");
assert(html.indexOf('id="player-controls" class="control-grid controls-drawer is-hidden"') !== -1, "player controls are hidden by default");
assert(html.indexOf("Play test video") === -1, "test video button was removed");
assert(html.indexOf("Account") === -1, "account screen was removed");
assert(html.indexOf("Diagnostics") === -1, "diagnostics screen was removed");
assert(html.indexOf("data-external-link") === -1, "dead external links were removed");
assert(html.indexOf('target="_blank"') === -1 && html.indexOf('target="_top"') === -1, "app UI does not use external navigation targets");
assert(html.indexOf('rel="manifest" href="manifest.webmanifest"') !== -1, "manifest is linked");
assert(html.indexOf('rel="icon" href="favicon.png"') !== -1, "favicon is linked");

assert(css.indexOf("width: 600px") !== -1 && css.indexOf("height: 600px") !== -1, "CSS fixes the 600px canvas");
assert(css.indexOf("background: var(--bg)") !== -1, "page background uses transparent black variable");
assert(css.indexOf("--bg: #000000") !== -1, "black is reserved for the page canvas");
assert(css.indexOf("--focus: #44d7ff") !== -1, "visible cyan focus ring is defined");
assert(css.indexOf("min-height: 88px") !== -1, "primary controls meet 88dp target");
assert(css.indexOf("height: 329px") !== -1 && css.indexOf("width: 584px") !== -1, "cinema player uses full-width 16:9 layout");
assert(css.indexOf(".controls-drawer.is-hidden") !== -1, "controls drawer can be hidden");

assert(js.indexOf("playlist.json") !== -1, "app fetches same-origin playlist JSON");
assert(js.indexOf("loadPlaylistData") !== -1, "playlist refresh logic is present");
assert(js.indexOf("startVideoByIndex") !== -1, "playlist item playback is present");
assert(js.indexOf("playRelative") !== -1, "next/previous playlist navigation is present");
assert(js.indexOf("data-preferred-focus") !== -1, "preferred D-pad focus is set");
assert(js.indexOf("setControlsVisible") !== -1, "controls mode toggle is implemented");
assert(js.indexOf("addEventListener(\"keydown\"") !== -1, "keydown listener is present");
assert(js.indexOf("event.preventDefault()") !== -1, "D-pad key handling prevents default scrolling");
assert(js.indexOf("window.open") === -1, "app does not use popup navigation");
assert(js.indexOf("window.top.location") === -1, "app does not attempt blocked top-level navigation");
assert(js.indexOf("window.YT.Player") !== -1, "YouTube web player API is used");
assert(js.indexOf("localStorage") !== -1, "localStorage persistence is present");
assert(js.indexOf("serviceWorker") !== -1, "service worker registration is present");
assert(js.indexOf("M7lc1UVf-VE") === -1, "old YouTube test video id was removed");
assert(!/client_secret|refresh_token|password\s*=|AIza[0-9A-Za-z_-]{20,}/.test(js), "app JS contains no Google secrets or API keys");

assert(playlist.playlistId === "PLG4ASdiTQRwQ", "playlist JSON uses requested playlist id");
assert(Array.isArray(playlist.videos) && playlist.videos.length > 0, "playlist JSON contains videos");
playlist.videos.forEach(function (video, index) {
  assert(/^[A-Za-z0-9_-]{11}$/.test(video.id), "video " + index + " has a valid YouTube id");
  assert(Boolean(video.title), "video " + index + " has a title");
});

assert(manifest.icons && manifest.icons[0] && manifest.icons[0].src === "favicon.png", "manifest references favicon.png");
assert(manifest.background_color === "#000000", "manifest background is black");
assert(manifest.display === "standalone", "manifest uses standalone display");
assert(manifest.name === "Meta Display Playlist", "manifest name matches playlist app");

assert(serviceWorker.indexOf("./playlist.json") !== -1, "service worker caches playlist JSON");
assert(refreshWorkflow.indexOf("workflow_dispatch") !== -1, "playlist refresh workflow can be run manually");
assert(refreshWorkflow.indexOf("schedule:") !== -1, "scheduled playlist refresh is enabled");
assert(refreshWorkflow.indexOf("0 16 * * *") !== -1, "schedule includes noon Eastern Daylight Time");
assert(refreshWorkflow.indexOf("0 17 * * *") !== -1, "schedule includes noon Eastern Standard Time");

// --- WebMCP (webmcp.js) -------------------------------------------------
// Load webmcp.js in a sandbox with a fake document.modelContext and check the
// real tool definitions against Meta's WebMCP rules
// (https://wearables.developer.meta.com/docs/develop/webapps/agent-tools/).
var webmcpSrc = read("webmcp.js");
assert(/<script src="webmcp\.js" defer><\/script>/.test(html), "index.html loads webmcp.js");
assert(serviceWorker.indexOf('"./webmcp.js"') !== -1, "service worker caches webmcp.js");
assert(webmcpSrc.indexOf("document.modelContext") !== -1, "webmcp.js uses document.modelContext");
assert(!/navigator\.modelContext/.test(webmcpSrc), "webmcp.js does not use navigator.modelContext");
assert(!/registerTool\([^)]*\)\s*\.catch/.test(webmcpSrc), "registerTool result is not chained with .catch");
var webmcpTools = [];
(function () {
  var vm = require("vm");
  function fakeEl() {
    return { style: {}, setAttribute: function () {}, appendChild: function () {}, textContent: "" };
  }
  var fakeDocument = {
    modelContext: { registerTool: function (def) { webmcpTools.push(def); return undefined; } },
    body: fakeEl(),
    documentElement: fakeEl(),
    createElement: fakeEl,
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    getElementById: function () { return null; }
  };
  var sandbox = { document: fakeDocument, console: console, Promise: Promise, DOMException: Error,
    setTimeout: setTimeout, clearTimeout: clearTimeout };
  sandbox.window = sandbox;
  try {
    vm.runInNewContext(webmcpSrc, sandbox, { filename: "webmcp.js" });
  } catch (error) {
    failures.push("webmcp.js throws at load: " + error.message);
  }
})();
var reserved = ["openUrl", "goBack", "goForward", "reload", "getCurrentUrl", "getPageTitle", "getPageText"];
var scalar = ["string", "number", "integer", "boolean"];
assert(webmcpTools.length >= 8, "webmcp.js registers at least 8 tools (got " + webmcpTools.length + ")");
var seenPrefixes = {};
webmcpTools.forEach(function (tool) {
  var name = String(tool.name || "");
  assert(/^[A-Za-z0-9_.-]{1,57}$/.test(name), "WebMCP tool name valid and <= 57 chars: " + name);
  assert(reserved.indexOf(name) === -1, "WebMCP tool name not reserved: " + name);
  assert(!seenPrefixes[name.slice(0, 57)], "WebMCP tool name unique: " + name);
  seenPrefixes[name.slice(0, 57)] = true;
  assert(typeof tool.description === "string" && tool.description.length > 0 && tool.description.length <= 1024, "WebMCP description 1-1024 chars: " + name);
  assert(typeof tool.execute === "function", "WebMCP execute is a function: " + name);
  var schema = tool.inputSchema;
  if (schema) {
    assert(schema.type === "object" && schema.properties && typeof schema.properties === "object", "WebMCP schema is a top-level object: " + name);
    Object.keys(schema.properties || {}).forEach(function (key) {
      var prop = schema.properties[key];
      assert(scalar.indexOf(prop.type) !== -1, "WebMCP param " + name + "." + key + " is scalar");
      assert(typeof prop.description === "string" && prop.description.length <= 256, "WebMCP param " + name + "." + key + " has description <= 256 chars");
    });
    (schema.required || []).forEach(function (key) {
      assert(schema.properties && schema.properties[key], "WebMCP required param exists: " + name + "." + key);
    });
    try { JSON.stringify(schema); } catch (error) { failures.push("WebMCP schema not serializable: " + name); }
  }
});

var size = readPngSize("favicon.png");
assert(size.width >= 53 && size.height >= 53, "favicon is larger than 52x52");

var gzipped = zlib.gzipSync(Buffer.from(js));
assert(gzipped.length < 500 * 1024, "JavaScript is under 500KB gzipped");

if (failures.length) {
  console.error("Check failed:");
  failures.forEach(function (failure) {
    console.error("- " + failure);
  });
  process.exit(1);
}

console.log("All checks passed.");
console.log("playlist videos: " + playlist.videos.length);
console.log("app.js gzip bytes: " + gzipped.length);
console.log("webmcp tools: " + webmcpTools.map(function (t) { return t.name; }).join(", "));
console.log("favicon: " + size.width + "x" + size.height + " PNG");
