import {
  Channel,
  FeaturedEvent,
  Category,
  Announcement,
  AppSettings,
  AdminUser,
  Country,
} from '../types/index.ts';
import { signInWithGoogleAdminPopup, signOutFirebaseAdmin, User } from './firebase.ts';
import {
  bootstrapFirestoreDatabase,
  syncChannelToFirestore,
  deleteChannelFromFirestore,
  syncEventToFirestore,
  deleteEventFromFirestore,
  syncCategoryToFirestore,
  syncAnnouncementToFirestore,
  syncSettingsToFirestore,
} from './firestoreData.ts';

const ADMIN_TOKEN_KEY = 'tapaiko_tv_admin_token';
const ADMIN_USER_KEY = 'tapaiko_tv_admin_user';

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

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredAdminUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAdminSession(token: string, user: AdminUser): void {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Unable to store admin session:', e);
  }
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    signOutFirebaseAdmin();
  } catch (e) {
    console.warn('Unable to clear admin session:', e);
  }
}

function getHeaders(requireAdmin = false): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (requireAdmin) {
    const token = getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

// ---------------- PUBLIC & ADMIN API CALLS ----------------

export async function fetchCountries(): Promise<Country[]> {
  const res = await fetch('/api/countries');
  if (!res.ok) throw new Error('Failed to load countries');
  return res.json();
}

export async function fetchCountryChannels(countryCode: string): Promise<{
  country: string;
  code: string;
  newlyAdded?: number;
  channels: Channel[];
}> {
  const res = await fetch(`/api/iptv/country/${encodeURIComponent(countryCode)}`);
  if (!res.ok) throw new Error(`Failed to fetch channels for country ${countryCode}`);
  return res.json();
}

export async function fetchChannels(
  includeHidden = false,
  country?: string,
  category?: string
): Promise<Channel[]> {
  const params = new URLSearchParams();
  if (country && country !== 'all') params.set('country', country);
  if (category && category !== 'all') params.set('category', category);
  const query = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`/api/channels${query}`, {
    headers: getHeaders(includeHidden),
  });
  if (!res.ok) throw new Error('Failed to load channels');
  return res.json();
}

export async function reportBrokenChannel(channelId: string): Promise<{
  deactivated: boolean;
  channelId: string;
  message: string;
}> {
  const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/report-broken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to report broken channel');
  return res.json();
}

export async function fetchAutoUpdateStatus(): Promise<AutoUpdateStatus> {
  const res = await fetch('/api/iptv/status');
  if (!res.ok) throw new Error('Failed to load auto-update status');
  return res.json();
}

export async function triggerAutoVerifySweep(): Promise<AutoUpdateStatus> {
  const res = await fetch('/api/iptv/auto-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to trigger verification sweep');
  return res.json();
}

export async function createChannel(data: Partial<Channel>): Promise<Channel> {
  const res = await fetch('/api/channels', {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create channel');
  }
  const created: Channel = await res.json();
  syncChannelToFirestore(created).catch(() => {});
  return created;
}

export async function updateChannel(id: string, data: Partial<Channel>): Promise<Channel> {
  const res = await fetch(`/api/channels/${id}`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update channel');
  const updated: Channel = await res.json();
  syncChannelToFirestore(updated).catch(() => {});
  return updated;
}

export async function deleteChannel(id: string): Promise<void> {
  const res = await fetch(`/api/channels/${id}`, {
    method: 'DELETE',
    headers: getHeaders(true),
  });
  if (!res.ok) throw new Error('Failed to delete channel');
  deleteChannelFromFirestore(id).catch(() => {});
}

export async function fetchEvents(includeHidden = false): Promise<FeaturedEvent[]> {
  const res = await fetch('/api/events', {
    headers: getHeaders(includeHidden),
  });
  if (!res.ok) throw new Error('Failed to load events');
  return res.json();
}

export async function createEvent(data: Partial<FeaturedEvent>): Promise<FeaturedEvent> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create event');
  }
  const created: FeaturedEvent = await res.json();
  syncEventToFirestore(created).catch(() => {});
  return created;
}

export async function updateEvent(id: string, data: Partial<FeaturedEvent>): Promise<FeaturedEvent> {
  const res = await fetch(`/api/events/${id}`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update event');
  const updated: FeaturedEvent = await res.json();
  syncEventToFirestore(updated).catch(() => {});
  return updated;
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`/api/events/${id}`, {
    method: 'DELETE',
    headers: getHeaders(true),
  });
  if (!res.ok) throw new Error('Failed to delete event');
  deleteEventFromFirestore(id).catch(() => {});
}

export async function fetchCategories(includeHidden = false): Promise<Category[]> {
  const res = await fetch('/api/categories', {
    headers: getHeaders(includeHidden),
  });
  if (!res.ok) throw new Error('Failed to load categories');
  return res.json();
}

export async function createCategory(data: Partial<Category>): Promise<Category> {
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create category');
  const created: Category = await res.json();
  syncCategoryToFirestore(created).catch(() => {});
  return created;
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  const res = await fetch(`/api/categories/${id}`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update category');
  const updated: Category = await res.json();
  syncCategoryToFirestore(updated).catch(() => {});
  return updated;
}

export async function fetchAnnouncements(includeHidden = false): Promise<Announcement[]> {
  const res = await fetch('/api/announcements', {
    headers: getHeaders(includeHidden),
  });
  if (!res.ok) throw new Error('Failed to load announcements');
  return res.json();
}

export async function createAnnouncement(data: Partial<Announcement>): Promise<Announcement> {
  const res = await fetch('/api/announcements', {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create announcement');
  const created: Announcement = await res.json();
  syncAnnouncementToFirestore(created).catch(() => {});
  return created;
}

export async function updateAnnouncement(id: string, data: Partial<Announcement>): Promise<Announcement> {
  const res = await fetch(`/api/announcements/${id}`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update announcement');
  const updated: Announcement = await res.json();
  syncAnnouncementToFirestore(updated).catch(() => {});
  return updated;
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  const updated: AppSettings = await res.json();
  syncSettingsToFirestore(updated).catch(() => {});
  return updated;
}

export async function loginAdminWithGoogle(): Promise<{ token: string; user: AdminUser }> {
  const googlePayload = await signInWithGoogleAdminPopup();

  const res = await fetch('/api/admin/google-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(googlePayload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Google Administrator verification failed');
  }

  const data = await res.json();
  setAdminSession(data.token, data.user);
  bootstrapFirestoreDatabase().catch(() => {});
  return data;
}

export async function restoreAdminSessionFromFirebaseUser(
  firebaseUser: User
): Promise<{ token: string; user: AdminUser } | null> {
  try {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch('/api/admin/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: firebaseUser.email,
        name: firebaseUser.displayName || 'Tapaiko TV Administrator',
        uid: firebaseUser.uid,
        idToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setAdminSession(data.token, data.user);
    bootstrapFirestoreDatabase().catch(() => {});
    return data;
  } catch {
    return null;
  }
}

export async function testStreamOnServer(url: string): Promise<{
  reachable: boolean;
  statusCode: number;
  contentType: string;
  corsHeader: string;
  hasHlsManifestHeader?: boolean;
  details: string;
}> {
  const res = await fetch('/api/admin/stream-test', {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error('Stream test request failed');
  return res.json();
}

export const testStreamAvailability = testStreamOnServer;

export async function resetToDemoData(): Promise<void> {
  const res = await fetch('/api/admin/reset-demo', {
    method: 'POST',
    headers: getHeaders(true),
  });
  if (!res.ok) throw new Error('Failed to reset demo data');
}

export const resetDemoData = resetToDemoData;

export async function syncIptvChannels(): Promise<{
  success: boolean;
  totalChannels: number;
  newlyAdded: number;
  message: string;
}> {
  const res = await fetch('/api/iptv/sync', {
    method: 'POST',
    headers: getHeaders(true),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to sync IPTV channels');
  }
  return res.json();
}
