# Open-Source IPTV Repository Integration & Compliance Guide

This guide details how **तपाईंको TV** discovers, verifies, and synchronizes legal, publicly available broadcast streams from open-source GitHub repositories such as [iptv-org](https://github.com/iptv-org/iptv).

---

## 1. Supported Open-Source Repositories

- **Main Repository**: `https://github.com/iptv-org/iptv`
- **Country Playlists**: `https://iptv-org.github.io/iptv/countries/{code}.m3u` (e.g. `np.m3u` for Nepal)
- **Category Playlists**: `https://iptv-org.github.io/iptv/categories/{category}.m3u` (e.g. `sports.m3u`, `news.m3u`)
- **Metadata Database**: `https://github.com/iptv-org/database` (logos, EPG IDs, broadcast languages, and country flags)

---

## 2. Ingestion & Quality Verification Pipeline

Raw M3U playlists frequently contain broken streams, expired Akamai session tokens, 403 Forbidden geoblocks, and missing CORS headers. **तपाईंको TV** utilizes a strict 4-step pipeline:

```
[GitHub M3U / JSON]
         │
         ▼
[Parser & Normalizer]  ── Extract tvg-id, tvg-logo, group-title, stream-url
         │
         ▼
[HTTP Head/Range Probe] ── Validate 200 OK, application/x-mpegURL or text/html
         │
         ▼
[Admin Review & Publish] ── Stored as draft; published upon manual/automated pass
```

### Stream Test Rules:
1. **HTTP Status Check**: Probes stream URL using `GET` / `HEAD` with range requests and redirects followed (up to 3 hops).
2. **HLS Manifest Signature**: Validates presence of `#EXTM3U` and `#EXT-X-STREAM-INF` / `#EXTINF` in header or first segment chunks.
3. **CORS Access**: Validates `Access-Control-Allow-Origin: *` to prevent in-browser client playback failure.

---

## 3. How to Trigger Sync

### Method 1: Using the Admin Control Room UI
1. Navigate to `http://localhost:3000/admin`.
2. Sign in with administrator credentials (`admin@tapaiko.tv`).
3. Click the **Channels** tab.
4. Click **"Sync from GitHub iptv-org"**.
5. The platform will fetch the latest verified streams, filter duplicates, probe endpoints, and display the sync summary.

### Method 2: Automated Server API Call
Administrators can trigger programmatic synchronization via cron job or webhook:

```bash
curl -X POST http://localhost:3000/api/iptv/sync \
  -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>"
```

Response:
```json
{
  "success": true,
  "totalChannels": 18,
  "newlyAdded": 0,
  "message": "GitHub IPTV playlist processed and probed successfully."
}
```

---

## 4. Legal Compliance & Broadcaster Rights

1. **Zero Piracy Guarantee**: **तपाईंको TV** does not host, restream, re-encode, or bypass access controls (DRM, tokens, or subscriber logins) for any content.
2. **DMCA & Takedown Procedure**:
   - Broadcasters may request stream removal at any time.
   - Administrators can instantaneously disable (`isActive: false`) or unpublish (`isPublished: false`) any channel from the Admin Control Room without rebuilding the web application.
   - Channels can also be permanently deleted from the database.
3. **Player Attribution**: All streams clearly display the official broadcaster name, country of origin, and source category.
