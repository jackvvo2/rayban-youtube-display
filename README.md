# Meta Display Playlist

A 600x600 Meta Ray-Ban Display compatible web app for playing a YouTube playlist inline with D-pad navigation.

The app no longer exposes dead outbound navigation. Meta Ray-Ban Display testing showed same-origin app reload works, but external top-level navigation does not leave the web app container.

The player screen uses a full-width cinema layout. Playback controls are hidden by default behind the Controls button beside Back.

## Features

- YouTube playlist playback optimized for Meta Ray-Ban Display
- OAuth 2.0 authentication with YouTube
- Secure token management with localStorage
- D-pad navigation (arrow keys)
- Responsive player controls
- Service worker caching for offline support

## YouTube OAuth Setup

### Prerequisites

You need Google OAuth credentials to enable YouTube login:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**
4. Create an OAuth 2.0 credential:
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/oauth/callback` (for local development)
     - `https://your-deployed-domain.com/oauth/callback` (for production)
   - Copy your **Client ID** and **Client Secret**

### Environment Variables

Create a `.env` file in the root directory (or export as environment variables):

```bash
YOUTUBE_CLIENT_ID=your_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
```

See `.env.example` for a template.

### Local Development

1. Set environment variables:
   ```bash
   export YOUTUBE_CLIENT_ID="your_client_id"
   export YOUTUBE_CLIENT_SECRET="your_client_secret"
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open http://localhost:3000 and click "Sign in with YouTube"

### Production Deployment

When deploying to production (e.g., GitHub Pages, Vercel):

1. Update `OAUTH_REDIRECT_URI` to your production domain
2. Add the production URL to Google OAuth authorized redirect URIs
3. Set environment variables in your deployment platform's secrets/config
4. Update the redirect URI in your code if needed

## Playlist

Configured playlist:

https://youtube.com/playlist?list=PL7bU9mtR4VuCsaFjk5VBO8gWRd7pkzqrO

Playlist metadata is generated into same-origin playlist.json from YouTube's public playlist RSS feed. The in-app Refresh button reloads that JSON without trying to navigate away from the app.

To refresh the checked-in playlist JSON:

~~~bash
npm run refresh-playlist
~~~

A GitHub Actions workflow exists for manual refreshes only. The scheduled 30-minute refresh is disabled to avoid spending Actions minutes.

## Run Locally

~~~bash
npm start
~~~

Open http://localhost:3000 and use arrow keys plus Enter to simulate the glasses D-pad.

## Device Setup

Meta Ray-Ban Display web apps need a public HTTPS URL. Add the deployed URL in the Meta AI app under Display Glasses settings, App connections, Web apps.

Public test URL:

~~~text
https://chrisclawguitarte.github.io/rayban-youtube-display/
~~~

The app uses:

- Fixed 600x600 viewport
- Dark transparent display canvas
- focusable controls with visible cyan focus
- Arrow key D-pad navigation
- Enter/Space activation
- Escape/Backspace back navigation
- Same-origin playlist refresh
- Static asset service worker cache
- YouTube OAuth authentication with secure token storage
