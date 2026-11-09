const FAVORITES_KEY = 'tapaiko_tv_favorites';
const RECENT_KEY = 'tapaiko_tv_recent_history';
const THEME_KEY = 'tapaiko_tv_theme';
const MAX_RECENT_CHANNELS = 10;

export function getLocalFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toggleLocalFavorite(channelId: string): string[] {
  try {
    const current = getLocalFavorites();
    const index = current.indexOf(channelId);
    let updated: string[];
    if (index >= 0) {
      updated = current.filter((id) => id !== channelId);
    } else {
      updated = [channelId, ...current];
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function isLocalFavorite(channelId: string): boolean {
  return getLocalFavorites().includes(channelId);
}

export function getLocalRecentChannelIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addLocalRecentChannel(channelId: string): string[] {
  try {
    const current = getLocalRecentChannelIds();
    const filtered = current.filter((id) => id !== channelId);
    const updated = [channelId, ...filtered].slice(0, MAX_RECENT_CHANNELS);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearLocalRecentChannels(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}

export function getSavedTheme(): 'dark' | 'light' {
  try {
    const val = localStorage.getItem(THEME_KEY);
    if (val === 'light' || val === 'dark') return val;
    return 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}
