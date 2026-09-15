(function () {
  "use strict";

  var AUTH_CONFIG = {
    storageKey: "rayban-youtube-display:auth:v1",
    tokenKey: "youtube_access_token",
    expiresKey: "youtube_token_expires",
    userKey: "youtube_user_info"
  };

  var authState = {
    isAuthenticated: false,
    accessToken: null,
    tokenExpires: null,
    userInfo: null
  };

  document.addEventListener("DOMContentLoaded", function () {
    initializeAuth();
    bindAuthEvents();
  });

  function initializeAuth() {
    // Check for OAuth callback token in URL
    var params = new URLSearchParams(window.location.search);
    var token = params.get("token");
    var expiresIn = params.get("expires_in");

    if (token) {
      // Save token from OAuth callback
      saveToken(token, expiresIn);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      showLoginScreen(false);
      return;
    }

    // Try to restore from localStorage
    restoreAuthState();

    if (authState.isAuthenticated && isTokenValid()) {
      showLoginScreen(false);
    } else {
      clearAuthState();
      showLoginScreen(true);
    }
  }

  function bindAuthEvents() {
    var loginBtn = document.getElementById("youtube-login-btn");
    var logoutBtn = document.getElementById("logout-btn");

    if (loginBtn) {
      loginBtn.addEventListener("click", function () {
        startYouTubeLogin();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        handleLogout();
      });
    }

    // Also handle logout action from app.js
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-action='logout']");
      if (target) {
        handleLogout();
      }
    });
  }

  function startYouTubeLogin() {
    fetch("/api/oauth-config")
      .then(function (response) {
        return response.json();
      })
      .then(function (config) {
        if (!config.clientId) {
          showAuthMessage("OAuth not configured. Set YOUTUBE_CLIENT_ID environment variable.", "error");
          return;
        }

        // Generate state for CSRF protection
        var state = generateRandomState();
        sessionStorage.setItem("oauth_state", state);

        var params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/youtube.readonly",
          access_type: "online",
          state: state
        });

        var authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
        window.location.href = authUrl;
      })
      .catch(function (error) {
        showAuthMessage("Failed to load OAuth configuration.", "error");
      });
  }

  function handleLogout() {
    clearAuthState();
    showLoginScreen(true);
    showToast("Logged out");
  }

  function saveToken(token, expiresIn) {
    var expiresInSeconds = parseInt(expiresIn, 10) || 3600;
    var expiresAt = new Date().getTime() + expiresInSeconds * 1000;

    authState.accessToken = token;
    authState.tokenExpires = expiresAt;
    authState.isAuthenticated = true;

    try {
      var storage = {
        accessToken: token,
        tokenExpires: expiresAt
      };
      window.localStorage.setItem(AUTH_CONFIG.storageKey, JSON.stringify(storage));
    } catch (error) {
      // LocalStorage may be disabled
    }

    // Store token globally for app.js
    window.YOUTUBE_AUTH = {
      accessToken: token,
      isAuthenticated: true
    };
  }

  function restoreAuthState() {
    try {
      var raw = window.localStorage.getItem(AUTH_CONFIG.storageKey);
      if (!raw) {
        return;
      }
      var saved = JSON.parse(raw);
      authState.accessToken = saved.accessToken;
      authState.tokenExpires = saved.tokenExpires;
      authState.isAuthenticated = true;

      // Make token available globally
      window.YOUTUBE_AUTH = {
        accessToken: saved.accessToken,
        isAuthenticated: true
      };
    } catch (error) {
      window.localStorage.removeItem(AUTH_CONFIG.storageKey);
    }
  }

  function clearAuthState() {
    authState.isAuthenticated = false;
    authState.accessToken = null;
    authState.tokenExpires = null;
    authState.userInfo = null;

    try {
      window.localStorage.removeItem(AUTH_CONFIG.storageKey);
    } catch (error) {
      // LocalStorage may be disabled
    }

    window.YOUTUBE_AUTH = {
      accessToken: null,
      isAuthenticated: false
    };
  }

  function isTokenValid() {
    if (!authState.accessToken || !authState.tokenExpires) {
      return false;
    }
    return new Date().getTime() < authState.tokenExpires;
  }

  function showLoginScreen(show) {
    var loginScreen = document.getElementById("login-screen");
    var homeScreen = document.getElementById("home-screen");

    if (!loginScreen || !homeScreen) {
      return;
    }

    if (show) {
      loginScreen.classList.add("active");
      homeScreen.classList.remove("active");
    } else {
      loginScreen.classList.remove("active");
      homeScreen.classList.add("active");
    }
  }

  function showAuthMessage(message, type) {
    var container = document.getElementById("auth-status");
    var messageEl = document.getElementById("auth-message");

    if (!container || !messageEl) {
      return;
    }

    messageEl.textContent = message;
    messageEl.className = type || "info";
    container.style.display = "block";

    if (type !== "error") {
      window.setTimeout(function () {
        container.style.display = "none";
      }, 5000);
    }
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.classList.add("visible");
    window.setTimeout(function () {
      toast.classList.remove("visible");
    }, 3000);
  }

  function generateRandomState() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var state = "";
    for (var i = 0; i < 32; i++) {
      state += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return state;
  }

  // Export auth state for app.js
  window.YouTubeAuth = {
    isAuthenticated: function () {
      return authState.isAuthenticated && isTokenValid();
    },
    getToken: function () {
      return authState.accessToken;
    },
    logout: handleLogout
  };
})();
