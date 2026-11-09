import { Channel } from '../types/index.ts';

export const AUTHORIZED_ADMIN_EMAIL = 'ceoofcrypto@gmail.com';

export interface ChannelFilterOptions {
  categorySlug?: string;
  searchQuery?: string;
  country?: string;
  language?: string;
  onlyFavorites?: boolean;
  favoriteIds?: string[];
  publicOnly?: boolean;
}

/**
 * Verifies whether an email address belongs to the sole authorized administrator (ceoofcrypto@gmail.com)
 */
export function isAdminEmailAuthorized(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL;
}

/**
 * Strips banned or CORP-blocked image URLs (Unsplash, Wikia/Fandom, Picsum)
 * so the UI renders a clean broadcast callsign monogram without network errors.
 */
export function sanitizeLogoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('images.unsplash.com') ||
    lower.includes('unsplash.com') ||
    lower.includes('wikia.nocookie.net') ||
    lower.includes('fandom.com') ||
    lower.includes('picsum.photos')
  ) {
    return '';
  }
  return trimmed;
}

const CALLSIGN_PALETTES = [
  'from-red-950/90 to-neutral-900 text-red-300 border-red-800/50',
  'from-amber-950/90 to-neutral-900 text-amber-300 border-amber-800/50',
  'from-sky-950/90 to-neutral-900 text-sky-300 border-sky-800/50',
  'from-emerald-950/90 to-neutral-900 text-emerald-300 border-emerald-800/50',
  'from-indigo-950/90 to-neutral-900 text-indigo-300 border-indigo-800/50',
  'from-rose-950/90 to-neutral-900 text-rose-300 border-rose-800/50',
];

/**
 * Generates a deterministic broadcast callsign monogram and studio color palette for channels without external logos
 */
export function getChannelMonogram(name: string): { initials: string; paletteClass: string } {
  const cleaned = (name || 'TV').replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  let initials = 'TV';
  if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    initials = words[0].slice(0, 2).toUpperCase();
  } else if (words.length === 1 && words[0].length === 1) {
    initials = words[0].toUpperCase();
  }

  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const paletteClass = CALLSIGN_PALETTES[hash % CALLSIGN_PALETTES.length];
  return { initials, paletteClass };
}

/**
 * Filter channels according to category, search keyword, and public viewer constraints.
 * Public viewers must ONLY see active, published, non-failing channels.
 */
export function filterChannels(
  channels: Channel[],
  options: ChannelFilterOptions = {}
): Channel[] {
  if (!channels || !Array.isArray(channels)) return [];

  const {
    categorySlug,
    searchQuery,
    country,
    language,
    onlyFavorites,
    favoriteIds = [],
    publicOnly = true,
  } = options;

  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  return channels
    .filter((ch) => {
      // 1. Public viewers only see active, published, and non-failing channels
      if (publicOnly && (!ch.isActive || !ch.isPublished || ch.verificationStatus === 'failing')) {
        return false;
      }

      // 2. Category filter
      if (categorySlug && categorySlug !== 'all') {
        if (categorySlug.toLowerCase() === 'indian-tv') {
          const isIndian =
            ch.categoryId.toLowerCase() === 'indian-tv' ||
            ch.countryCode?.toUpperCase() === 'IN' ||
            ch.country?.toLowerCase() === 'india';
          if (!isIndian) {
            return false;
          }
        } else if (categorySlug.toLowerCase() === 'nepali-tv') {
          const isNepali =
            ch.categoryId.toLowerCase() === 'nepali-tv' ||
            ch.countryCode?.toUpperCase() === 'NP' ||
            ch.country?.toLowerCase() === 'nepal';
          if (!isNepali) {
            return false;
          }
        } else if (ch.categoryId.toLowerCase() !== categorySlug.toLowerCase()) {
          return false;
        }
      }

      // 3. Favorites filter
      if (onlyFavorites && !favoriteIds.includes(ch.id)) {
        return false;
      }

      // 4. Country filter
      if (country && country !== 'all') {
        const q = country.trim().toUpperCase();
        const codeMatch = ch.countryCode && ch.countryCode.toUpperCase() === q;
        const nameMatch = ch.country && ch.country.toUpperCase() === q;
        const lowerMatch = ch.country && ch.country.toLowerCase() === country.trim().toLowerCase();
        if (!codeMatch && !nameMatch && !lowerMatch) {
          return false;
        }
      }

      // 5. Language filter
      if (language && language !== 'all' && ch.language.toLowerCase() !== language.toLowerCase()) {
        return false;
      }

      // 6. Text search filter
      if (normalizedQuery) {
        const matchName = ch.name.toLowerCase().includes(normalizedQuery);
        const matchNepali = ch.nepaliName?.toLowerCase().includes(normalizedQuery) || false;
        const matchCategory = ch.categoryName.toLowerCase().includes(normalizedQuery);
        const matchDesc = ch.description.toLowerCase().includes(normalizedQuery);
        const matchCountry = ch.country.toLowerCase().includes(normalizedQuery);
        const matchCountryCode = ch.countryCode?.toLowerCase() === normalizedQuery;
        const matchLang = ch.language.toLowerCase().includes(normalizedQuery);

        if (
          !matchName &&
          !matchNepali &&
          !matchCategory &&
          !matchDesc &&
          !matchCountry &&
          !matchCountryCode &&
          !matchLang
        ) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // Verified channels first for public viewers
      if (a.verificationStatus === 'verified' && b.verificationStatus !== 'verified') return -1;
      if (b.verificationStatus === 'verified' && a.verificationStatus !== 'verified') return 1;
      // Priority sort: lower number = higher priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.name.localeCompare(b.name);
    });
}
