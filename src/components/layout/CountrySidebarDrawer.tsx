import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Country } from '../../types/index.ts';
import { groupCountriesAlphabetically, searchCountries, CountryGroup } from '../../utils/countryHelpers.ts';
import { Globe, Search, X, Check, ChevronRight, RotateCcw } from 'lucide-react';

interface CountrySidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  countries: Country[];
  selectedCountry: string; // 'all' or ISO 2-letter code or country name
  onSelectCountry: (countryCode: string) => void;
  channelCountsByCountry?: Record<string, number>;
}

export const CountrySidebarDrawer: React.FC<CountrySidebarDrawerProps> = ({
  isOpen,
  onClose,
  countries,
  selectedCountry,
  onSelectCountry,
  channelCountsByCountry = {},
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered countries based on search
  const filteredCountries = useMemo(() => {
    return searchCountries(countries, searchQuery);
  }, [countries, searchQuery]);

  // Grouped countries from A to Z
  const countryGroups = useMemo<CountryGroup[]>(() => {
    return groupCountriesAlphabetically(filteredCountries);
  }, [filteredCountries]);

  // Available letters for quick jump
  const availableLetters = useMemo(() => {
    const set = new Set(countryGroups.map((g) => g.letter));
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((char) => ({
      char,
      hasCountries: set.has(char),
    }));
  }, [countryGroups]);

  // Scroll to letter section
  const scrollToLetter = (letter: string) => {
    const element = document.getElementById(`country-group-${letter}`);
    if (element && scrollContainerRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isAllSelected = !selectedCountry || selectedCountry === 'all';

  // Resolved selected country object
  const activeCountryObj = useMemo(() => {
    if (isAllSelected) return null;
    const q = selectedCountry.toUpperCase();
    return countries.find((c) => c.code.toUpperCase() === q || c.name.toUpperCase() === q);
  }, [isAllSelected, selectedCountry, countries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Sidebar Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Country Filter Sidebar"
        className="fixed inset-y-0 left-0 max-w-full flex"
      >
        <div className="w-screen max-w-md bg-[#121316] border-r border-neutral-800 text-neutral-100 flex flex-col shadow-2xl relative">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800/90 bg-[#16181d] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Countries Directory</span>
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                    A–Z
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Select a country to filter live broadcasts (250 countries)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              aria-label="Close country sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Selection Banner if any */}
          {activeCountryObj && (
            <div className="px-4 py-2.5 bg-red-950/40 border-b border-red-900/40 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">{activeCountryObj.flag}</span>
                <span className="font-semibold text-red-200">
                  Filtering: {activeCountryObj.name}
                </span>
                <span className="font-mono text-[10px] text-red-400 uppercase">
                  ({activeCountryObj.code})
                </span>
              </div>
              <button
                onClick={() => {
                  onSelectCountry('all');
                  onClose();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-200 text-[11px] font-medium transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Show All</span>
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="p-3 sm:p-4 border-b border-neutral-800/80 bg-[#121316] shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search countries by name or ISO code (e.g. India, Nepal, US)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1a1c22] border border-neutral-700/70 focus:border-red-500 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* A–Z Quick Jump Alphabet Strip */}
            {!searchQuery && (
              <div className="flex items-center justify-between gap-0.5 mt-2.5 pt-2 border-t border-neutral-800/60 overflow-x-auto scrollbar-none py-1">
                {availableLetters.map(({ char, hasCountries }) => (
                  <button
                    key={char}
                    onClick={() => hasCountries && scrollToLetter(char)}
                    disabled={!hasCountries}
                    className={`text-[10px] font-mono px-1 py-0.5 rounded transition-colors ${
                      hasCountries
                        ? 'text-neutral-400 hover:text-white hover:bg-neutral-800 font-bold'
                        : 'text-neutral-700 cursor-not-allowed'
                    }`}
                    title={`Jump to ${char}`}
                  >
                    {char}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable Countries List (A to Z) */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 divide-y divide-neutral-800/40"
          >
            {/* Top Option: Show All Countries */}
            <div className="pb-2">
              <button
                onClick={() => {
                  onSelectCountry('all');
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  isAllSelected
                    ? 'bg-neutral-200 text-neutral-900 border-neutral-200 font-bold shadow-md'
                    : 'bg-[#181a20] hover:bg-neutral-800/80 border-neutral-800 text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-lg">
                    🌐
                  </div>
                  <div>
                    <p className="text-xs font-semibold">All Countries</p>
                    <p
                      className={`text-[10px] ${
                        isAllSelected ? 'text-neutral-700' : 'text-neutral-500'
                      }`}
                    >
                      Browse full global catalog (2,500+ feeds)
                    </p>
                  </div>
                </div>
                {isAllSelected && <Check className="w-4 h-4 text-neutral-900 shrink-0" />}
              </button>
            </div>

            {/* Render Country Groups A to Z */}
            {countryGroups.length > 0 ? (
              countryGroups.map((group) => (
                <div
                  key={group.letter}
                  id={`country-group-${group.letter}`}
                  className="pt-3 space-y-1.5"
                >
                  <div className="sticky top-0 z-10 bg-[#121316]/95 backdrop-blur-sm py-1 px-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-red-500 font-mono tracking-wider">
                      {group.letter}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {group.countries.length} {group.countries.length === 1 ? 'country' : 'countries'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {group.countries.map((country) => {
                      const isSelected =
                        selectedCountry?.toUpperCase() === country.code.toUpperCase() ||
                        selectedCountry?.toLowerCase() === country.name.toLowerCase();

                      const count =
                        channelCountsByCountry[country.code.toUpperCase()] ||
                        channelCountsByCountry[country.name.toLowerCase()] ||
                        0;

                      return (
                        <button
                          key={country.code}
                          onClick={() => {
                            onSelectCountry(country.code);
                            onClose();
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-red-950/60 border-red-700 text-white font-semibold shadow-sm'
                              : 'bg-[#16181d]/80 hover:bg-neutral-800/90 border-neutral-800/80 text-neutral-300 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-xl shrink-0 leading-none">
                              {country.flag}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{country.name}</p>
                              <span className="text-[10px] font-mono text-neutral-500 uppercase">
                                {country.code}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {count > 0 ? (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                                  isSelected
                                    ? 'bg-red-900/80 text-red-200'
                                    : 'bg-neutral-800 text-neutral-400'
                                }`}
                              >
                                {count} {count === 1 ? 'channel' : 'channels'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-500">Live</span>
                            )}
                            {isSelected ? (
                              <Check className="w-4 h-4 text-red-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-neutral-500 space-y-2">
                <Globe className="w-8 h-8 text-neutral-700 mx-auto" />
                <p>No countries match &ldquo;{searchQuery}&rdquo;</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-red-400 hover:underline text-xs"
                >
                  Clear search query
                </button>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-3 bg-[#16181d] border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 px-4 shrink-0">
            <span>
              Showing {filteredCountries.length} of {countries.length} countries
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
