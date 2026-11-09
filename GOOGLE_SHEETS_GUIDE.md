# Google Sheets & Google Apps Script Integration Guide for तपाईंको TV

This guide provides instructions for operating **तपाईंको TV** using Google Sheets as an alternative lightweight spreadsheet CMS for non-technical administrators.

---

## 1. Spreadsheet Schema Architecture

Create a new Google Sheet named `Tapaiko TV CMS` with five sheets (tabs):

### Tab 1: `CHANNELS`
| Column Header | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Unique channel identifier | `kantipur-tv` |
| `name` | string | Channel display name | `Kantipur TV HD` |
| `nepaliName` | string | Devanagari name | `कान्तिपुर टेलिभिजन` |
| `logoUrl` | string | Direct image CDN URL | `https://.../logo.png` |
| `streamUrl` | string | HLS manifest URL (.m3u8) | `https://.../playlist.m3u8` |
| `streamType` | string | `hls`, `dash`, or `mp4` | `hls` |
| `categoryId` | string | Category ID reference | `nepali-tv` |
| `categoryName` | string | Category display label | `Nepali TV` |
| `country` | string | Broadcaster origin | `Nepal` |
| `language` | string | Audio language | `Nepali` |
| `description` | string | Short description | `Leading Nepali 24/7 news channel` |
| `isActive` | boolean | Channel operational status | `TRUE` |
| `isPublished` | boolean | Public visibility | `TRUE` |
| `priority` | number | Display rank (1 = highest) | `1` |
| `updatedAt` | string | ISO timestamp | `2026-11-05T20:00:00Z` |

### Tab 2: `FEATURED_EVENTS`
| Column Header | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Unique event ID | `nsl-final-2026` |
| `title` | string | Event headline | `Nepal Super League Final` |
| `nepaliTitle` | string | Devanagari headline | `नेपाल सुपर लिग फाइनल` |
| `subtitle` | string | Event sub-headline | `Kathmandu Rayzrs vs Lalitpur City` |
| `description` | string | Broadcast summary | `Live from Dasharath Stadium` |
| `channelId` | string | Associated channel ID | `kantipur-tv` |
| `channelName` | string | Channel name label | `Kantipur TV HD` |
| `streamUrlOverride` | string | Optional special stream | `` |
| `status` | string | `LIVE`, `UPCOMING`, `ENDED` | `LIVE` |
| `startTime` | string | Nepal Time ISO | `2026-11-06T18:00:00+05:45` |
| `priority` | number | 1 = Highest hero priority | `1` |
| `buttonLabel` | string | CTA label | `Watch Live Now` |
| `isActive` | boolean | Event enabled | `TRUE` |
| `isPublished` | boolean | Publicly visible | `TRUE` |

### Tab 3: `CATEGORIES`
| Column Header | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Category slug ID | `nepali-tv` |
| `name` | string | Display label | `Nepali TV` |
| `nepaliName` | string | Devanagari label | `नेपाली टिभी` |
| `icon` | string | Lucide icon name | `Tv` |
| `isActive` | boolean | Enabled flag | `TRUE` |
| `displayOrder` | number | Menu position order | `1` |

### Tab 4: `ANNOUNCEMENTS`
| Column Header | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Notice ID | `welcome-banner` |
| `title` | string | Announcement title | `Welcome to तपाईंको TV` |
| `message` | string | Notice text | `तपाईंको TV मा स्वागत छ` |
| `type` | string | `info`, `warning`, `live` | `info` |
| `isActive` | boolean | Enabled flag | `TRUE` |
| `isPublished` | boolean | Public visibility | `TRUE` |

### Tab 5: `SETTINGS`
| Column Header | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `key` | string | Config setting key | `maintenanceMode` |
| `value` | string | JSON or boolean value | `false` |

---

## 2. Google Apps Script Webhook Code

In your Google Sheet, open **Extensions > Apps Script** and paste:

```javascript
const ADMIN_API_KEY = "ChangeThisToAStrongSecretAdminToken";

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const path = e.parameter.tab || "all";
  
  const result = {};
  
  if (path === "all" || path === "channels") {
    result.channels = getSheetData(ss.getSheetByName("CHANNELS"))
      .filter(row => row.isActive === true && row.isPublished === true);
  }
  
  if (path === "all" || path === "events") {
    result.events = getSheetData(ss.getSheetByName("FEATURED_EVENTS"))
      .filter(row => row.isActive === true && row.isPublished === true)
      .sort((a, b) => Number(a.priority) - Number(b.priority));
  }
  
  if (path === "all" || path === "categories") {
    result.categories = getSheetData(ss.getSheetByName("CATEGORIES"))
      .filter(row => row.isActive === true)
      .sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder));
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const headers = e.headers || {};
  const token = headers["x-admin-token"] || e.parameter.token;
  
  if (token !== ADMIN_API_KEY) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle administrator write operations here...
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  
  return rows.slice(1).map(row => {
    const item = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val === "TRUE") val = true;
      if (val === "FALSE") val = false;
      item[h] = val;
    });
    return item;
  });
}
```

---

## 3. Deployment Steps

1. Click **Deploy > New Deployment**.
2. Select type **Web App**.
3. Set **Execute as**: `Me`.
4. Set **Who has access**: `Anyone`.
5. Copy the generated Web App URL into your environment variable:
   ```env
   GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"
   ```
6. The public frontend retrieves published channels seamlessly while edits in Google Sheets reflect immediately on the site.
