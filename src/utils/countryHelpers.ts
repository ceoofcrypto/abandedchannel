import { Country } from '../types/index.ts';

export interface CountryGroup {
  letter: string;
  countries: Country[];
}

/**
 * Groups and sorts countries alphabetically from A to Z.
 * Returns an array of CountryGroups ordered from A to Z.
 */
export function groupCountriesAlphabetically(countries: Country[]): CountryGroup[] {
  if (!countries || !Array.isArray(countries)) return [];

  // Sort all countries by name first (A-Z)
  const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const groupsMap: Record<string, Country[]> = {};

  for (const country of sorted) {
    if (!country.name) continue;
    const firstChar = country.name.trim().charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
    if (!groupsMap[letter]) {
      groupsMap[letter] = [];
    }
    groupsMap[letter].push(country);
  }

  // Order letters A to Z, with '#' at end if present
  const letters = Object.keys(groupsMap).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  return letters.map((letter) => ({
    letter,
    countries: groupsMap[letter],
  }));
}

/**
 * Filter countries by query (name, code, or language)
 */
export function searchCountries(countries: Country[], query: string): Country[] {
  if (!query || !query.trim()) {
    return [...countries].sort((a, b) => a.name.localeCompare(b.name));
  }
  const clean = query.trim().toLowerCase();
  return countries.filter(
    (c) =>
      c.name.toLowerCase().includes(clean) ||
      c.code.toLowerCase().includes(clean) ||
      c.languages?.some((l) => l.toLowerCase().includes(clean))
  ).sort((a, b) => a.name.localeCompare(b.name));
}
