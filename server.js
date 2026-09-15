var http = require("http");
var fs = require("fs");
var path = require("path");
var url = require("url");
var querystring = require("querystring");

var PORT = process.env.PORT || 3000;
var ROOT = __dirname;

// OAuth configuration from environment variables
var OAUTH_CONFIG = {
  clientId: process.env.YOUTUBE_CLIENT_ID || "",
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
  redirectUri: process.env.OAUTH_REDIRECT_URI || "http://localhost:3000/oauth/callback"
};

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

  // OAuth callback endpoint
  if (pathname === "/oauth/callback") {
    handleOAuthCallback(req, res, parsedUrl);
    return;
  }

  // OAuth config endpoint - only send safe public info
  if (pathname === "/api/oauth-config") {
    handleOAuthConfig(res);
    return;
  }

  // Static file serving
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

function handleOAuthConfig(res) {
  // Return only the public OAuth client ID
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({
    clientId: OAUTH_CONFIG.clientId,
    redirectUri: OAUTH_CONFIG.redirectUri
  }));
}

function handleOAuthCallback(req, res, parsedUrl) {
  var code = parsedUrl.query.code;
  var state = parsedUrl.query.state;
  var error = parsedUrl.query.error;

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>Authorization Error</h1><p>" + encodeHTMLEntities(error) + "</p><p><a href=\"/\">Back to app</a></p>");
    return;
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>Missing Authorization Code</h1><p><a href=\"/\">Back to app</a></p>");
    return;
  }

  // Exchange authorization code for access token
  var postData = querystring.stringify({
    code: code,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    grant_type: "authorization_code"
  });

  var options = {
    hostname: "oauth2.googleapis.com",
    path: "/token",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData)
    }
  };

  var request = require("https").request(options, function (response) {
    var body = "";
    response.on("data", function (chunk) {
      body += chunk;
    });
    response.on("end", function () {
      try {
        var tokenData = JSON.parse(body);
        if (tokenData.access_token) {
          // Redirect back to app with token in hash (safer than query string)
          res.writeHead(302, {
            "Location": "/?token=" + encodeURIComponent(tokenData.access_token) + 
                       "&expires_in=" + encodeURIComponent(tokenData.expires_in || 3600)
          });
          res.end();
        } else {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h1>Token Exchange Failed</h1><p>" + encodeHTMLEntities(tokenData.error || "Unknown error") + "</p><p><a href=\"/\">Back to app</a></p>");
        }
      } catch (parseError) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Token Exchange Error</h1><p><a href=\"/\">Back to app</a></p>");
      }
    });
  });

  request.on("error", function (error) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>Server Error</h1><p><a href=\"/\">Back to app</a></p>");
  });

  request.write(postData);
  request.end();
}

function encodeHTMLEntities(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

server.listen(PORT, function () {
  console.log("Ray-Ban YouTube Display running at http://localhost:" + PORT);
  if (!OAUTH_CONFIG.clientId) {
    console.warn("Warning: YouTube OAuth not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables.");
  }
});
