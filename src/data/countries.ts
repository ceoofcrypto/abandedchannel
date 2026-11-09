import { Country } from '../types/index.ts';
import countriesData from './countries.json' with { type: 'json' };

export const ALL_COUNTRIES: Country[] = countriesData as Country[];

// Popular / Featured countries for quick filter chips
export const POPULAR_COUNTRIES: Country[] = [
  { name: 'Nepal', code: 'NP', flag: '🇳🇵' },
  { name: 'India', code: 'IN', flag: '🇮🇳' },
  { name: 'United States', code: 'US', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'UK', flag: '🇬🇧' },
  { name: 'Qatar', code: 'QA', flag: '🇶🇦' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪' },
  { name: 'France', code: 'FR', flag: '🇫🇷' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { name: 'Turkey', code: 'TR', flag: '🇹🇷' },
  { name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
  { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
];

export const COUNTRY_BY_CODE: Record<string, Country> = {};
export const COUNTRY_BY_NAME: Record<string, Country> = {};

ALL_COUNTRIES.forEach((c) => {
  COUNTRY_BY_CODE[c.code.toUpperCase()] = c;
  COUNTRY_BY_NAME[c.name.toLowerCase()] = c;
});

// Alias UK and GB
if (COUNTRY_BY_CODE['UK'] && !COUNTRY_BY_CODE['GB']) {
  COUNTRY_BY_CODE['GB'] = COUNTRY_BY_CODE['UK'];
} else if (COUNTRY_BY_CODE['GB'] && !COUNTRY_BY_CODE['UK']) {
  COUNTRY_BY_CODE['UK'] = COUNTRY_BY_CODE['GB'];
}

export function getCountryFlag(countryNameOrCode?: string): string {
  if (!countryNameOrCode) return '🌐';
  const clean = countryNameOrCode.trim();
  const upper = clean.toUpperCase();
  if (COUNTRY_BY_CODE[upper]) {
    return COUNTRY_BY_CODE[upper].flag;
  }
  const lower = clean.toLowerCase();
  if (COUNTRY_BY_NAME[lower]) {
    return COUNTRY_BY_NAME[lower].flag;
  }
  // Common manual overrides
  if (lower === 'nepal' || upper === 'NP') return '🇳🇵';
  if (lower === 'india' || upper === 'IN') return '🇮🇳';
  if (lower === 'usa' || lower === 'united states' || upper === 'US') return '🇺🇸';
  if (lower === 'uk' || lower === 'united kingdom' || upper === 'UK' || upper === 'GB') return '🇬🇧';
  if (lower === 'global' || lower === 'international') return '🌐';
  return '📺';
}

export function getCountryName(code: string): string {
  const upper = code.trim().toUpperCase();
  return COUNTRY_BY_CODE[upper]?.name || code;
}

export function normalizeCountryCode(nameOrCode: string): string {
  if (!nameOrCode) return 'NP';
  const clean = nameOrCode.trim();
  const upper = clean.toUpperCase();
  if (COUNTRY_BY_CODE[upper]) return upper;
  const lower = clean.toLowerCase();
  if (COUNTRY_BY_NAME[lower]) return COUNTRY_BY_NAME[lower].code.toUpperCase();
  if (lower === 'usa' || lower === 'united states') return 'US';
  if (lower === 'uk' || lower === 'united kingdom') return 'UK';
  return upper.slice(0, 2);
}
