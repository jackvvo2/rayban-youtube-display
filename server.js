var http = require("http");
var fs = require("fs");
var path = require("path");
var url = require("url");

var PORT = process.env.PORT || 3000;
var ROOT = __dirname;

var mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png"
};

var server = http.createServer(function (req, res) {
  var parsedUrl = url.parse(req.url, true);
  var pathname = decodeURIComponent(parsedUrl.pathname);

  var filePath = pathname === "/" ? "/index.html" : pathname;
  var resolved = path.resolve(ROOT, "." + filePath);

  if (!resolved.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, function (err, content) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    var ext = path.extname(resolved);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(content);
  });
});

server.listen(PORT, function () {
  console.log("Ray-Ban YouTube Display running at http://localhost:" + PORT);
});
