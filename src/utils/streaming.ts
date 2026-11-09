import { StreamType } from '../types/index.ts';

/**
 * Detect stream container or format from URL
 */
export function detectStreamType(url: string): StreamType {
  if (!url) return 'hls';
  const cleanUrl = url.toLowerCase().split('?')[0];
  if (cleanUrl.endsWith('.m3u8')) return 'hls';
  if (cleanUrl.endsWith('.mpd')) return 'dash';
  if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.ogg')) {
    return 'direct';
  }
  return 'hls';
}

/**
 * Validates whether a URL is a syntactically valid HTTP/HTTPS URL
 */
export function isValidStreamUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Human-readable friendly error description for player diagnostics
 */
export function getFriendlyStreamError(errorCode: string | number, details?: string): string {
  const detailStr = String(details || '').toLowerCase();
  
  if (detailStr.includes('cors') || detailStr.includes('access-control-allow-origin')) {
    return 'The broadcaster’s streaming server restricts web browser playback with cross-origin (CORS) security policies.';
  }
  if (detailStr.includes('manifestloaderror') || detailStr.includes('404')) {
    return 'Stream manifest could not be retrieved. The live broadcast feed may currently be offline or geo-restricted.';
  }
  if (detailStr.includes('keyloaderror') || detailStr.includes('drm')) {
    return 'This broadcast is protected by digital rights encryption (DRM) or requires subscriber tokens.';
  }
  if (detailStr.includes('bufferappenderror') || detailStr.includes('codec')) {
    return 'The video encoding format is not natively decoded by this browser.';
  }
  return 'Unable to establish a stable connection with this live stream. Please check your internet or retry.';
}

/**
 * Exponential backoff calculation for player retries with strict caps
 */
export function calculateBackoffDelay(retryAttempt: number, baseMs: number = 1000, maxMs: number = 8000): number {
  const delay = baseMs * Math.pow(2, Math.min(retryAttempt, 3));
  return Math.min(delay, maxMs);
}

/**
 * Returns the server-side proxied HLS stream URL to bypass CORS, HTTP mixed-content, and Referer checks
 */
export function getProxiedStreamUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('/api/stream-proxy')) return rawUrl;
  return `/api/stream-proxy?url=${encodeURIComponent(rawUrl.trim())}`;
}

/**
 * Determines whether a stream URL should immediately use the proxy (e.g., plain HTTP on an HTTPS origin or non-standard port)
 */
export function shouldPreferStreamProxy(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim().toLowerCase();
  if (trimmed.startsWith('http://')) return true;
  if (trimmed.includes(':8443/') || trimmed.includes(':8080/') || trimmed.includes(':1935/')) return true;
  return false;
}
