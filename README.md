# तपाईंको TV — Your Television, Everywhere

A minimalist, high-performance IPTV and Live TV platform engineered for discovering and streaming legal, publicly available live television broadcasts.

Built with **React 19, TypeScript, Tailwind CSS, Express, and hls.js**, featuring zero-friction public viewing and a secure administrator control room.

---

## 1. Product Philosophy & Access Model

- **PUBLIC VIEWERS NEVER NEED TO LOG IN**:
  - Anyone can open the website and start watching immediately.
  - No registration, phone/OTP verification, subscription, or paywall.
  - Personal favorites and recently watched channels are stored locally in the viewer's browser via `localStorage`.
- **ADMINISTRATOR ACCESS (LOGIN REQUIRED)**:
  - Accessible via `/admin` and `/admin/login`.
  - Secure credential validation and session token.
  - Full CRUD control over live channels, stream endpoints, featured priority events, categories, and site settings.

---

## 2. Dynamic Priority Featured Events

The hero section at the top of the homepage is dynamically controlled by administrators:
- **Priority System**: 1 is the highest priority (e.g. Priority #1 is displayed first).
- **Status Indicators**:
  - `LIVE`: Displays a pulsing red LIVE badge and "Watch Live Now" action.
  - `UPCOMING`: Displays scheduled start date/time in Nepal Time (`Asia/Kathmandu` · UTC+05:45).
  - `ENDED` / `CANCELLED`: Automatically demoted or hidden from public viewers.
- **Dynamic Updates**: Changing priority or status in the Admin Portal updates the public homepage immediately without recompiling or redeploying the app.

---

## 3. Streaming Engine (`hls.js`)

- **Formats Supported**: HLS (`.m3u8`), native HTML5 video (Safari iOS), and direct MP4/WebM.
- **Adaptive Bitrates**: Automatically detects stream levels (1080p, 720p, 480p, 360p) and allows manual quality selection.
- **Capped Exponential Backoff**: Automatically handles transient network dropouts with a maximum of 3 retries (1s, 2s, 4s, capped at 8s).
- **CORS & Codec Diagnostics**: Honest error explanations when a stream cannot be played due to broadcaster geo-blocking, CORS headers, or DRM.
- **Autoplay Compliance**: Starts muted by default with a visible "Tap to Unmute" action, complying with modern browser media policies.

---

## 4. Default Demonstration Credentials

For testing the Administrator Control Room:

To change or secure these credentials in production, configure environment variables or connect Firebase Authentication.

---

## 5. Firebase Architecture & Security Rules

The repository includes complete production-grade Firebase configurations:
- `firebase-blueprint.json`: Intermediate representation schema defining all entities and collection paths.
- `firestore.rules`: Attribute-Based Access Control (ABAC) rules:
  - Default-deny catch-all rule on `{document=**}`.
  - Public unauthenticated read access granted strictly to records where `isActive == true && isPublished == true`.
  - Write operations strictly gated to administrators verified against `/admins/$(request.auth.uid)`.
  - Volumetric boundary limits and `.size()` constraints preventing Denial-of-Wallet attacks.
- `storage.rules`: Strict file type and size limitations (5MB max) for broadcaster logos and banners.
- `firestore.indexes.json`: Composite indexes for filtered priority queries.

---

## 6. Optional Google Sheets Integration Guide

If preferred over Firebase, Google Sheets can be connected via Google Apps Script:
1. Create a Google Sheet with 5 tabs:
   - `CHANNELS`: `id | name | logoUrl | streamUrl | categoryId | country | language | isActive | isPublished | priority`
   - `FEATURED_EVENTS`: `id | title | subtitle | channelId | status | startTime | priority | isActive | isPublished`
   - `CATEGORIES`: `id | name | slug | isActive | displayOrder`
   - `ANNOUNCEMENTS`: `id | title | message | isActive | isPublished`
   - `SETTINGS`: `key | value`
2. Deploy a Google Apps Script Web App:
   - `doGet(e)`: Returns published JSON data with `ContentService.MimeType.JSON`.
   - `doPost(e)`: Verifies an admin bearer token in request headers before executing writes.
3. Configure the webhook URL in the app's API client.

---

## 7. Open-Source IPTV Repository Integration Guide

The platform is compatible with public open-source IPTV repositories (such as [iptv-org](https://github.com/iptv-org/iptv)):
1. Streams imported from open repositories are stored with `sourceType: 'iptv-org'` and `verificationStatus: 'untested'`.
2. Administrators can test stream reachability using the built-in **Stream Diagnostic Probe** in the Admin Portal.
3. Once validated, administrators set `isPublished: true` to make the channel available to public viewers.
4. Always respect broadcaster territorial restrictions, terms of service, and copyright.

---

## 8. Development & Build

```bash
# Install dependencies
npm install

# Run logic tests
npx --yes tsx --test src/utils/logic.test.ts

# Start full-stack development server (Express API + Vite on port 3000)
npm run dev

# Build for production
npm run build
```
