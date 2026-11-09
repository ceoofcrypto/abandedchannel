import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  INITIAL_CATEGORIES,
  INITIAL_CHANNELS,
  INITIAL_EVENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_SETTINGS,
} from './src/data/seedData.ts';
import { Channel, FeaturedEvent, Category, Announcement, AppSettings, Country } from './src/types/index.ts';
import { ALL_COUNTRIES } from './src/data/countries.ts';
import { sanitizeLogoUrl, isAdminEmailAuthorized, AUTHORIZED_ADMIN_EMAIL } from './src/utils/channels.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DatabaseState {
  channels: Channel[];
  events: FeaturedEvent[];
  categories: Category[];
  announcements: Announcement[];
  settings: AppSettings;
}

export interface AutoUpdateStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  verifiedCount: number;
  activeCount: number;
  removedDeadCount: number;
  newlyAddedCount: number;
  lastBatchChecked: number;
}

const EVENT_BANNER_MAP: Record<string, string> = {
  'event-nsl-final': '/images/event_nsl_stadium.jpg',
  'event-aci-racing': '/images/event_motorsport_race.jpg',
  'event-nasa-space': '/images/event_nasa_earth.jpg',
};

function sanitizeEvents(events: FeaturedEvent[]): FeaturedEvent[] {
  return events.map((ev) => {
    const mappedBanner = EVENT_BANNER_MAP[ev.id];
    const cleanThumb =
      ev.thumbnailUrl?.includes('unsplash.com') || !ev.thumbnailUrl
        ? mappedBanner || '/images/event_nsl_stadium.jpg'
        : ev.thumbnailUrl;
    const cleanBanner =
      ev.bannerUrl?.includes('unsplash.com') || !ev.bannerUrl
        ? mappedBanner || '/images/event_nsl_stadium.jpg'
        : ev.bannerUrl;
    return {
      ...ev,
      thumbnailUrl: cleanThumb,
      bannerUrl: cleanBanner,
    };
  });
}

function sanitizeChannelList(channels: Channel[]): Channel[] {
  const seenUrls = new Set<string>();
  const cleaned: Channel[] = [];

  for (const ch of channels) {
    if (!ch || !ch.streamUrl) continue;
    const urlKey = ch.streamUrl.trim();
    if (!urlKey || seenUrls.has(urlKey)) continue;
    seenUrls.add(urlKey);

    const isFailing = ch.verificationStatus === 'failing';
    cleaned.push({
      ...ch,
      logoUrl: sanitizeLogoUrl(ch.logoUrl),
      isActive: isFailing ? false : ch.isActive,
    });
  }
  return cleaned;
}

function loadDatabase(): DatabaseState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const existingChannels: Channel[] = Array.isArray(parsed.channels) ? parsed.channels : [];
      const existingUrls = new Set(existingChannels.map((c: Channel) => c.streamUrl?.trim()));
      const mergedChannels: Channel[] = [...existingChannels];

      for (const ch of INITIAL_CHANNELS) {
        if (!existingUrls.has(ch.streamUrl.trim())) {
          mergedChannels.push(ch);
          existingUrls.add(ch.streamUrl.trim());
        }
      }

      const sanitizedState: DatabaseState = {
        channels: sanitizeChannelList(mergedChannels),
        events: sanitizeEvents(parsed.events || INITIAL_EVENTS),
        categories: parsed.categories || INITIAL_CATEGORIES,
        announcements: parsed.announcements || INITIAL_ANNOUNCEMENTS,
        settings: parsed.settings || INITIAL_SETTINGS,
      };
      saveDatabase(sanitizedState);
      return sanitizedState;
    }
  } catch (err) {
    console.error('Error loading db.json, falling back to seed:', err);
  }

  const initial: DatabaseState = {
    channels: sanitizeChannelList(INITIAL_CHANNELS),
    events: sanitizeEvents(INITIAL_EVENTS),
    categories: INITIAL_CATEGORIES,
    announcements: INITIAL_ANNOUNCEMENTS,
    settings: INITIAL_SETTINGS,
  };
  saveDatabase(initial);
  return initial;
}

function saveDatabase(state: DatabaseState): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

let db = loadDatabase();

const app = express();
app.use(express.json({ limit: '10mb' }));

// Google Sign-In Admin Session Management (strictly restricted to authorized admin)
const activeAdminSessions = new Map<string, { email: string; name: string; uid: string; issuedAt: number }>();

function verifyFirebaseAdminJwt(token: string): { email: string; name: string; uid: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);
    if (
      payload &&
      payload.aud === 'gen-lang-client-0781064726' &&
      isAdminEmailAuthorized(payload.email) &&
      payload.email_verified === true
    ) {
      return {
        email: payload.email,
        name: payload.name || 'Administrator',
        uid: payload.user_id || payload.sub || '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isValidAdminRequest(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1];
  const session = activeAdminSessions.get(token);
  if (session && isAdminEmailAuthorized(session.email)) {
    return true;
  }
  const jwtUser = verifyFirebaseAdminJwt(token);
  if (jwtUser) {
    activeAdminSessions.set(token, { ...jwtUser, issuedAt: Date.now() });
    return true;
  }
  return false;
}

function verifyAdmin(req: Request, res: Response, next: () => void) {
  if (!isValidAdminRequest(req)) {
    return res.status(403).json({
      error: 'Forbidden: Administrator Google Sign-In required.',
    });
  }
  next();
}

/**
 * Verifies that an HLS (.m3u8) or direct broadcast stream URL is reachable and returns a valid manifest
 */
async function verifyHlsStream(rawUrl: string, timeoutMs: number = 4500): Promise<boolean> {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl.trim());
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return false;
    }
  } catch {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain, */*',
        Origin: targetUrl.origin,
        Referer: targetUrl.origin + '/',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return false;

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('video/') || contentType.includes('mp4') || contentType.includes('webm')) {
      return true;
    }

    // Read up to 4KB to confirm valid #EXTM3U header
    const text = await res.text();
    const head = text.slice(0, 4096);
    if (
      head.includes('#EXTM3U') ||
      head.includes('#EXT-X-STREAM-INF') ||
      head.includes('#EXTINF') ||
      head.includes('#EXT-X-TARGETDURATION')
    ) {
      return true;
    }

    return false;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

// Helper to rewrite relative and absolute URLs inside an HLS .m3u8 manifest so they route through /api/stream-proxy
function rewriteM3u8Manifest(manifestText: string, baseUrl: string): string {
  const lines = manifestText.split(/\r?\n/);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => {
          try {
            const resolved = new URL(uri, baseUrl).toString();
            return `URI="/api/stream-proxy?url=${encodeURIComponent(resolved)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      try {
        const resolved = new URL(trimmed, baseUrl).toString();
        return `/api/stream-proxy?url=${encodeURIComponent(resolved)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

// ------------------- BACKGROUND CHANNEL AUTO-UPDATER & VERIFIER -------------------

const autoUpdateState: AutoUpdateStatus = {
  isRunning: false,
  lastRunAt: null,
  nextRunAt: null,
  verifiedCount: 0,
  activeCount: 0,
  removedDeadCount: 0,
  newlyAddedCount: 0,
  lastBatchChecked: 0,
};

const AUTO_SYNC_COUNTRY_CODES = ['NP', 'IN', 'US', 'GB', 'CA', 'AU', 'KR', 'JP', 'DE', 'FR', 'IT', 'ES', 'BR'];
let syncCountryCursor = 0;

function refreshAutoUpdateCounts() {
  autoUpdateState.activeCount = db.channels.filter(
    (c) => c.isActive && c.isPublished && c.verificationStatus !== 'failing'
  ).length;
  autoUpdateState.verifiedCount = db.channels.filter(
    (c) => c.isActive && c.isPublished && c.verificationStatus === 'verified'
  ).length;
}
refreshAutoUpdateCounts();

async function runBackgroundChannelCycle(batchSize: number = 12): Promise<AutoUpdateStatus> {
  if (autoUpdateState.isRunning) return autoUpdateState;
  autoUpdateState.isRunning = true;

  try {
    // 1. Pick active channels to verify: prioritize featured & high priority first, then untested, then oldest verified
    const candidates = db.channels
      .filter((c) => c.isActive && c.isPublished)
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        if (a.verificationStatus === 'untested' && b.verificationStatus !== 'untested') return -1;
        if (b.verificationStatus === 'untested' && a.verificationStatus !== 'untested') return 1;
        if (a.priority !== b.priority) return a.priority - b.priority;
        const timeA = a.lastVerifiedAt ? new Date(a.lastVerifiedAt).getTime() : 0;
        const timeB = b.lastVerifiedAt ? new Date(b.lastVerifiedAt).getTime() : 0;
        return timeA - timeB;
      })
      .slice(0, batchSize);

    let changed = false;
    await Promise.all(
      candidates.map(async (channel) => {
        const isWorking = await verifyHlsStream(channel.streamUrl, 4200);
        const now = new Date().toISOString();
        const target = db.channels.find((c) => c.id === channel.id);
        if (!target) return;

        if (isWorking) {
          if (target.verificationStatus !== 'verified' || !target.isActive) {
            changed = true;
          }
          target.verificationStatus = 'verified';
          target.isActive = true;
          target.lastVerifiedAt = now;
          target.updatedAt = now;
        } else {
          target.verificationStatus = 'failing';
          target.isActive = false;
          target.lastVerifiedAt = now;
          target.updatedAt = now;
          autoUpdateState.removedDeadCount += 1;
          changed = true;
        }
      })
    );

    autoUpdateState.lastBatchChecked = candidates.length;

    // 2. Auto-discover and verify fresh working channels from iptv-org country feeds
    const countryCode = AUTO_SYNC_COUNTRY_CODES[syncCountryCursor % AUTO_SYNC_COUNTRY_CODES.length];
    syncCountryCursor = (syncCountryCursor + 1) % AUTO_SYNC_COUNTRY_CODES.length;
    const addedFromCountry = await fetchAndVerifyCountryStreams(countryCode, 4);
    if (addedFromCountry.length > 0) {
      autoUpdateState.newlyAddedCount += addedFromCountry.length;
      changed = true;
    }

    if (changed) {
      saveDatabase(db);
    }

    const nowIso = new Date().toISOString();
    autoUpdateState.lastRunAt = nowIso;
    autoUpdateState.nextRunAt = new Date(Date.now() + 40000).toISOString();
    refreshAutoUpdateCounts();
  } catch (err) {
    console.warn('Background channel verification cycle warning:', err);
  } finally {
    autoUpdateState.isRunning = false;
  }

  return autoUpdateState;
}

/**
 * Fetches an iptv-org country playlist, tests candidate streams with verifyHlsStream,
 * and ONLY adds verified working channels to db.channels.
 */
async function fetchAndVerifyCountryStreams(rawCode: string, maxToAdd: number = 10): Promise<Channel[]> {
  const codeUpper = rawCode.trim().toUpperCase();
  const countryObj = ALL_COUNTRIES.find(
    (c) => c.code.toUpperCase() === codeUpper || c.name.toUpperCase() === codeUpper
  );
  const countryName = countryObj ? countryObj.name : codeUpper;
  const countryCode = countryObj ? countryObj.code.toUpperCase() : codeUpper;
  const m3uCode = countryCode === 'GB' ? 'uk' : countryCode.toLowerCase();
  const playlistUrl = `https://iptv-org.github.io/iptv/countries/${m3uCode}.m3u`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    const fetchRes = await fetch(playlistUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!fetchRes.ok) return [];

    const text = await fetchRes.text();
    const lines = text.split('\n');
    const existingUrls = new Set(db.channels.map((c) => c.streamUrl.trim()));
    const rawCandidates: Array<{ name: string; logo: string; group: string; streamUrl: string }> = [];
    let cur: { name: string; logo: string; group: string } | null = null;

    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const lastComma = line.lastIndexOf(',');
        const name = lastComma !== -1 ? line.substring(lastComma + 1).trim() : 'Channel';
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        const groupMatch = line.match(/group-title="([^"]*)"/);
        cur = {
          name,
          logo: logoMatch ? logoMatch[1] : '',
          group: groupMatch ? groupMatch[1] : '',
        };
      } else if (line.trim().startsWith('http') && cur) {
        const streamUrl = line.trim();
        if (!existingUrls.has(streamUrl)) {
          existingUrls.add(streamUrl);
          rawCandidates.push({
            name: cur.name,
            logo: cur.logo,
            group: cur.group,
            streamUrl,
          });
        }
        cur = null;
        if (rawCandidates.length >= maxToAdd * 3) break;
      }
    }

    const verifiedChannels: Channel[] = [];
    const chunkSize = 8;

    for (let i = 0; i < rawCandidates.length && verifiedChannels.length < maxToAdd; i += chunkSize) {
      const batch = rawCandidates.slice(i, i + chunkSize);
      const results = await Promise.all(
        batch.map(async (item) => {
          const ok = await verifyHlsStream(item.streamUrl, 4000);
          return ok ? item : null;
        })
      );

      for (const item of results) {
        if (!item || verifiedChannels.length >= maxToAdd) continue;

        const groupLower = item.group.toLowerCase();
        let categoryId = 'international';
        let categoryName = 'International';
        if (countryCode === 'NP') {
          categoryId = 'nepali-tv';
          categoryName = 'Nepali TV';
        } else if (groupLower.includes('sport')) {
          categoryId = 'sports';
          categoryName = 'Sports';
        } else if (groupLower.includes('news')) {
          categoryId = 'news';
          categoryName = 'News';
        } else if (groupLower.includes('music')) {
          categoryId = 'music';
          categoryName = 'Music';
        } else if (
          groupLower.includes('entertainment') ||
          groupLower.includes('movie') ||
          groupLower.includes('series') ||
          groupLower.includes('comedy')
        ) {
          categoryId = 'entertainment';
          categoryName = 'Entertainment';
        }

        const now = new Date().toISOString();
        const channelId = `ch-${countryCode.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        const newCh: Channel = {
          id: channelId,
          name: item.name,
          logoUrl: sanitizeLogoUrl(item.logo),
          streamUrl: item.streamUrl,
          streamType: 'hls',
          categoryId,
          categoryName,
          country: countryName,
          countryCode,
          language: countryObj?.languages?.[0] || 'English',
          description: `${item.name} verified live broadcast from ${countryName}.`,
          isActive: true,
          isPublished: true,
          isFeatured: false,
          priority: 20,
          sourceType: 'iptv-org',
          verificationStatus: 'verified',
          lastVerifiedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        verifiedChannels.push(newCh);
        db.channels.push(newCh);
      }
    }

    if (verifiedChannels.length > 0) {
      saveDatabase(db);
      refreshAutoUpdateCounts();
    }

    return verifiedChannels;
  } catch {
    return [];
  }
}

// Start background channel verification and auto-sync worker
function startBackgroundChannelUpdater() {
  setTimeout(() => {
    runBackgroundChannelCycle(16);
  }, 2500);

  setInterval(() => {
    runBackgroundChannelCycle(12);
  }, 40000);
}

// ------------------- API ROUTES -------------------

// HLS Stream Proxy to bypass browser CORS, HTTP mixed-content, and Referer blocks
app.get('/api/stream-proxy', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return res.status(400).send('Invalid protocol');
    }
  } catch {
    return res.status(400).send('Malformed url parameter');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const upstreamRes = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        Origin: targetUrl.origin,
        Referer: targetUrl.origin + '/',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Upstream returned ${upstreamRes.status}`);
    }

    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
    const finalUrl = upstreamRes.url || targetUrl.toString();
    const cleanPath = finalUrl.split('?')[0].toLowerCase();

    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u') ||
      cleanPath.endsWith('.m3u8') ||
      cleanPath.endsWith('.m3u');

    if (isM3u8) {
      const text = await upstreamRes.text();
      if (text.includes('#EXTM3U')) {
        const rewritten = rewriteM3u8Manifest(text, finalUrl);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(rewritten);
      }
      res.setHeader('Content-Type', contentType || 'text/plain');
      return res.send(text);
    }

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    } else {
      res.setHeader('Content-Type', 'video/mp2t');
    }
    const arrayBuffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).send(`Stream proxy error: ${msg}`);
  }
});

// Google Sign-In Admin Login (Restricted exclusively to ceoofcrypto@gmail.com)
app.post('/api/admin/google-login', (req: Request, res: Response) => {
  const { email, name, uid, idToken } = req.body;
  if (!email || !uid || !idToken) {
    return res.status(400).json({ error: 'Google authentication payload is incomplete.' });
  }

  if (!isAdminEmailAuthorized(email)) {
    return res.status(403).json({
      error: 'Unauthorized account. Access denied.',
    });
  }

  const sessionToken = idToken || `tapaiko_google_admin_${crypto.randomBytes(24).toString('hex')}`;
  activeAdminSessions.set(sessionToken, {
    email: AUTHORIZED_ADMIN_EMAIL,
    name: name || 'Administrator',
    uid,
    issuedAt: Date.now(),
  });

  return res.json({
    token: sessionToken,
    user: {
      email: AUTHORIZED_ADMIN_EMAIL,
      name: name || 'Administrator',
      role: 'superadmin',
    },
  });
});

// Admin verify token
app.get('/api/admin/verify', verifyAdmin, (req: Request, res: Response) => {
  const token = (req.headers.authorization || '').split(' ')[1];
  const session = activeAdminSessions.get(token);
  res.json({
    valid: true,
    user: {
      email: session?.email || AUTHORIZED_ADMIN_EMAIL,
      name: session?.name || 'Tapaiko TV Administrator',
      role: 'superadmin',
    },
  });
});

// Background Auto-Updater Status
app.get('/api/iptv/status', (req: Request, res: Response) => {
  refreshAutoUpdateCounts();
  res.json(autoUpdateState);
});

// Trigger immediate background verification sweep
app.post('/api/iptv/auto-verify', async (req: Request, res: Response) => {
  const status = await runBackgroundChannelCycle(20);
  res.json(status);
});

// Report broken channel from client player -> immediately deactivate so dead channels never persist
app.post('/api/channels/:id/report-broken', async (req: Request, res: Response) => {
  const channel = db.channels.find((c) => c.id === req.params.id);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  // Double-check stream on server; if unreachable, deactivate immediately
  const isActuallyAlive = await verifyHlsStream(channel.streamUrl, 3000);
  const now = new Date().toISOString();

  if (!isActuallyAlive) {
    channel.isActive = false;
    channel.verificationStatus = 'failing';
    channel.lastVerifiedAt = now;
    channel.updatedAt = now;
    autoUpdateState.removedDeadCount += 1;
    saveDatabase(db);
    refreshAutoUpdateCounts();
    return res.json({
      deactivated: true,
      channelId: channel.id,
      message: 'Broken stream verified offline and removed from active lineup.',
    });
  }

  return res.json({
    deactivated: false,
    channelId: channel.id,
    message: 'Stream responded on server probe.',
  });
});

// Countries catalog
app.get('/api/countries', (req: Request, res: Response) => {
  const counts: Record<string, number> = {};
  for (const ch of db.channels) {
    if (ch.isActive && ch.isPublished && ch.verificationStatus !== 'failing') {
      if (ch.countryCode) {
        counts[ch.countryCode.toUpperCase()] = (counts[ch.countryCode.toUpperCase()] || 0) + 1;
      }
      if (ch.country) {
        counts[ch.country.toLowerCase()] = (counts[ch.country.toLowerCase()] || 0) + 1;
      }
    }
  }

  const enriched: Country[] = ALL_COUNTRIES.map((c) => ({
    ...c,
    channelCount: counts[c.code.toUpperCase()] || counts[c.name.toLowerCase()] || 0,
  }));
  res.json(enriched);
});

// Dynamic country channels fetcher from GitHub iptv-org (only adds VERIFIED working streams)
app.get('/api/iptv/country/:code', async (req: Request, res: Response) => {
  const rawCode = (req.params.code || '').trim().toUpperCase();
  const countryObj = ALL_COUNTRIES.find(
    (c) => c.code.toUpperCase() === rawCode || c.name.toUpperCase() === rawCode
  );
  const countryName = countryObj ? countryObj.name : rawCode;
  const countryCode = countryObj ? countryObj.code.toUpperCase() : rawCode;

  const existing = db.channels.filter(
    (c) =>
      c.isActive &&
      c.isPublished &&
      c.verificationStatus !== 'failing' &&
      ((c.countryCode && c.countryCode.toUpperCase() === countryCode) ||
        (c.country && c.country.toLowerCase() === countryName.toLowerCase()))
  );

  if (existing.length >= 6) {
    return res.json({ country: countryName, code: countryCode, channels: existing });
  }

  const newlyVerified = await fetchAndVerifyCountryStreams(countryCode, 10);

  const allChannels = db.channels.filter(
    (c) =>
      c.isActive &&
      c.isPublished &&
      c.verificationStatus !== 'failing' &&
      ((c.countryCode && c.countryCode.toUpperCase() === countryCode) ||
        (c.country && c.country.toLowerCase() === countryName.toLowerCase()))
  );

  return res.json({
    country: countryName,
    code: countryCode,
    newlyAdded: newlyVerified.length,
    channels: allChannels,
  });
});

// Channels
app.get('/api/channels', (req: Request, res: Response) => {
  const isAdmin = isValidAdminRequest(req);

  let list = isAdmin
    ? db.channels
    : db.channels.filter((c) => c.isActive && c.isPublished && c.verificationStatus !== 'failing');

  const countryParam = req.query.country as string | undefined;
  if (countryParam && countryParam.trim() && countryParam.toLowerCase() !== 'all') {
    const q = countryParam.trim().toUpperCase();
    list = list.filter(
      (c) =>
        (c.countryCode && c.countryCode.toUpperCase() === q) ||
        (c.country && c.country.toUpperCase() === q) ||
        (c.country && c.country.toLowerCase() === countryParam.trim().toLowerCase())
    );
  }

  const categoryParam = req.query.category as string | undefined;
  if (categoryParam && categoryParam.trim() && categoryParam.toLowerCase() !== 'all') {
    list = list.filter(
      (c) => c.categoryId === categoryParam || c.categoryName.toLowerCase() === categoryParam.toLowerCase()
    );
  }

  return res.json(list);
});

app.get('/api/channels/:id', (req: Request, res: Response) => {
  const channel = db.channels.find((c) => c.id === req.params.id);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  const isAdmin = isValidAdminRequest(req);
  if (!isAdmin && (!channel.isActive || !channel.isPublished || channel.verificationStatus === 'failing')) {
    return res.status(404).json({ error: 'Channel not found or currently unavailable' });
  }
  res.json(channel);
});

app.post('/api/channels', verifyAdmin, async (req: Request, res: Response) => {
  const body = req.body;
  if (!body.name || !body.streamUrl || !body.categoryId) {
    return res.status(400).json({ error: 'Channel name, stream URL, and category are required' });
  }

  const streamUrl = body.streamUrl.trim();
  const isWorking = await verifyHlsStream(streamUrl, 5000);
  if (!isWorking) {
    return res.status(400).json({
      error: 'Stream verification failed: This stream URL is offline or did not return a valid HLS manifest. Only working channels can be added.',
    });
  }

  const now = new Date().toISOString();
  const id = body.id || 'ch-' + Date.now().toString(36);
  const newChannel: Channel = {
    id,
    name: body.name.trim(),
    nepaliName: body.nepaliName?.trim() || '',
    logoUrl: sanitizeLogoUrl(body.logoUrl),
    streamUrl,
    streamType: body.streamType || 'hls',
    categoryId: body.categoryId,
    categoryName: body.categoryName || 'General',
    country: body.country?.trim() || 'Nepal',
    countryCode: body.countryCode?.trim().toUpperCase() || undefined,
    language: body.language?.trim() || 'Nepali',
    description: body.description?.trim() || '',
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : true,
    isFeatured: Boolean(body.isFeatured),
    priority: Number(body.priority) || 10,
    sourceType: body.sourceType || 'manual',
    verificationStatus: 'verified',
    lastVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  db.channels.push(newChannel);
  saveDatabase(db);
  refreshAutoUpdateCounts();
  res.status(201).json(newChannel);
});

app.put('/api/channels/:id', verifyAdmin, (req: Request, res: Response) => {
  const index = db.channels.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const existing = db.channels[index];
  const updated: Channel = {
    ...existing,
    ...req.body,
    logoUrl: req.body.logoUrl !== undefined ? sanitizeLogoUrl(req.body.logoUrl) : existing.logoUrl,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  db.channels[index] = updated;
  saveDatabase(db);
  refreshAutoUpdateCounts();
  res.json(updated);
});

app.delete('/api/channels/:id', verifyAdmin, (req: Request, res: Response) => {
  const index = db.channels.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  const deleted = db.channels.splice(index, 1);
  saveDatabase(db);
  refreshAutoUpdateCounts();
  res.json({ success: true, deleted: deleted[0] });
});

// Featured Events
app.get('/api/events', (req: Request, res: Response) => {
  const isAdmin = isValidAdminRequest(req);

  if (!isAdmin) {
    const publicEvents = db.events.filter((e) => e.isActive && e.isPublished);
    return res.json(publicEvents);
  }
  return res.json(db.events);
});

app.post('/api/events', verifyAdmin, (req: Request, res: Response) => {
  const body = req.body;
  if (!body.title || !body.channelId) {
    return res.status(400).json({ error: 'Event title and target channel ID are required' });
  }

  const id = body.id || 'event-' + Date.now().toString(36);
  const newEvent: FeaturedEvent = {
    id,
    title: body.title.trim(),
    nepaliTitle: body.nepaliTitle?.trim() || '',
    subtitle: body.subtitle?.trim() || '',
    description: body.description?.trim() || '',
    thumbnailUrl: body.thumbnailUrl?.trim() || '/images/event_nsl_stadium.jpg',
    bannerUrl: body.bannerUrl?.trim() || '/images/event_nsl_stadium.jpg',
    channelId: body.channelId,
    channelName: body.channelName || '',
    streamUrlOverride: body.streamUrlOverride?.trim() || null,
    status: body.status || 'UPCOMING',
    startTime: body.startTime || new Date().toISOString(),
    endTime: body.endTime || null,
    priority: Number(body.priority) || 1,
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : true,
    buttonLabel: body.buttonLabel?.trim() || 'Watch Live',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.events.push(newEvent);
  saveDatabase(db);
  res.status(201).json(newEvent);
});

app.put('/api/events/:id', verifyAdmin, (req: Request, res: Response) => {
  const index = db.events.findIndex((e) => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const existing = db.events[index];
  const updated: FeaturedEvent = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  db.events[index] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/events/:id', verifyAdmin, (req: Request, res: Response) => {
  const index = db.events.findIndex((e) => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Event not found' });
  }
  const deleted = db.events.splice(index, 1);
  saveDatabase(db);
  res.json({ success: true, deleted: deleted[0] });
});

// Categories
app.get('/api/categories', (req: Request, res: Response) => {
  const isAdmin = isValidAdminRequest(req);

  const cats = isAdmin ? db.categories : db.categories.filter((c) => c.isActive);
  const counts: Record<string, number> = {};
  db.channels.forEach((ch) => {
    if (ch.isActive && ch.isPublished && ch.verificationStatus !== 'failing') {
      counts[ch.categoryId] = (counts[ch.categoryId] || 0) + 1;
    }
  });

  const enriched = cats.map((cat) => ({
    ...cat,
    channelCount: counts[cat.id] || 0,
  }));

  res.json(enriched);
});

app.post('/api/categories', verifyAdmin, (req: Request, res: Response) => {
  const body = req.body;
  if (!body.name || !body.slug) {
    return res.status(400).json({ error: 'Category name and slug are required' });
  }
  const newCat: Category = {
    id: body.id || body.slug.toLowerCase().trim(),
    name: body.name.trim(),
    nepaliName: body.nepaliName?.trim() || body.name.trim(),
    slug: body.slug.toLowerCase().trim(),
    icon: body.icon || 'tv',
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    displayOrder: Number(body.displayOrder) || db.categories.length + 1,
  };

  db.categories.push(newCat);
  saveDatabase(db);
  res.status(201).json(newCat);
});

app.put('/api/categories/:id', verifyAdmin, (req: Request, res: Response) => {
  const index = db.categories.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Category not found' });
  }
  db.categories[index] = { ...db.categories[index], ...req.body };
  saveDatabase(db);
  res.json(db.categories[index]);
});

// Announcements
app.get('/api/announcements', (req: Request, res: Response) => {
  const isAdmin = isValidAdminRequest(req);

  if (!isAdmin) {
    const active = db.announcements.filter((a) => a.isActive && a.isPublished);
    return res.json(active);
  }
  return res.json(db.announcements);
});

app.post('/api/announcements', verifyAdmin, (req: Request, res: Response) => {
  const body = req.body;
  if (!body.title || !body.message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }
  const newAnn: Announcement = {
    id: body.id || 'ann-' + Date.now().toString(36),
    title: body.title.trim(),
    message: body.message.trim(),
    nepaliMessage: body.nepaliMessage?.trim() || '',
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : true,
    startTime: body.startTime || null,
    endTime: body.endTime || null,
    displayOrder: Number(body.displayOrder) || 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.announcements.push(newAnn);
  saveDatabase(db);
  res.status(201).json(newAnn);
});

app.put('/api/announcements/:id', verifyAdmin, (req: Request, res: Response) => {
  const index = db.announcements.findIndex((a) => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Announcement not found' });
  }
  db.announcements[index] = { ...db.announcements[index], ...req.body, updatedAt: new Date().toISOString() };
  saveDatabase(db);
  res.json(db.announcements[index]);
});

// Settings
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(db.settings);
});

app.put('/api/settings', verifyAdmin, (req: Request, res: Response) => {
  db.settings = { ...db.settings, ...req.body, updatedAt: new Date().toISOString() };
  saveDatabase(db);
  res.json(db.settings);
});

// Stream Test Endpoint
app.post('/api/admin/stream-test', verifyAdmin, async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Stream URL is required' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || 'unknown';
    const accessControl = response.headers.get('access-control-allow-origin') || 'not-specified';
    const status = response.status;
    const ok = response.ok;

    let isManifestValid = false;
    if (ok) {
      const textSample = await response.text();
      isManifestValid =
        textSample.includes('#EXTM3U') ||
        textSample.includes('#EXT-X-STREAM-INF') ||
        textSample.includes('#EXTINF');
    }

    res.json({
      reachable: ok,
      statusCode: status,
      contentType,
      corsHeader: accessControl,
      hasHlsManifestHeader: isManifestValid,
      details: ok
        ? isManifestValid
          ? 'Stream manifest retrieved and verified. Format is valid HLS playlist.'
          : 'HTTP response 200 OK. Content-type: ' + contentType
        : `Server responded with HTTP ${status}. Stream may be offline or restricted.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.json({
      reachable: false,
      statusCode: 0,
      contentType: 'error',
      details: `Network test failed: ${errorMsg}.`,
    });
  }
});

// Reset to Default Demo Data
app.post('/api/admin/reset-demo', verifyAdmin, (req: Request, res: Response) => {
  db = {
    channels: sanitizeChannelList([...INITIAL_CHANNELS]),
    events: sanitizeEvents([...INITIAL_EVENTS]),
    categories: [...INITIAL_CATEGORIES],
    announcements: [...INITIAL_ANNOUNCEMENTS],
    settings: { ...INITIAL_SETTINGS },
  };
  saveDatabase(db);
  refreshAutoUpdateCounts();
  res.json({ success: true, message: 'Reset to default demonstration data' });
});

// Automated IPTV Sync from open source GitHub repositories (verifies streams before adding & prunes failing ones)
app.post('/api/iptv/sync', verifyAdmin, async (req: Request, res: Response) => {
  try {
    let newlyAdded = 0;
    const existingUrls = new Set(db.channels.map((c) => c.streamUrl.trim()));

    const seedCandidates = INITIAL_CHANNELS.filter((c) => !existingUrls.has(c.streamUrl.trim()));
    for (const channel of seedCandidates) {
      const isWorking = await verifyHlsStream(channel.streamUrl, 4000);
      if (isWorking) {
        const now = new Date().toISOString();
        db.channels.push({
          ...channel,
          logoUrl: sanitizeLogoUrl(channel.logoUrl),
          isActive: true,
          verificationStatus: 'verified',
          lastVerifiedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        existingUrls.add(channel.streamUrl.trim());
        newlyAdded++;
      }
    }

    // Also run a background verification cycle
    await runBackgroundChannelCycle(20);
    saveDatabase(db);
    refreshAutoUpdateCounts();

    res.json({
      success: true,
      totalChannels: autoUpdateState.activeCount,
      newlyAdded: newlyAdded + autoUpdateState.newlyAddedCount,
      message: `Synchronized and verified working channels. Active verified lineup: ${autoUpdateState.activeCount} channels (${autoUpdateState.removedDeadCount} offline feeds pruned).`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `IPTV Sync failed: ${errorMsg}` });
  }
});

// ------------------- SERVER / VITE STARTUP -------------------

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`तपाईंको TV server running on http://0.0.0.0:${PORT}`);
    startBackgroundChannelUpdater();
  });
}

startServer();
